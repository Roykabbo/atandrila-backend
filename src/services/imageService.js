const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { IMAGE } = require('../config/constants');

const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

/**
 * Ensure upload directories exist
 */
const ensureDirectories = async () => {
  const dirs = [
    path.join(UPLOAD_DIR, 'products'),
    path.join(UPLOAD_DIR, 'products/thumbnails'),
    path.join(UPLOAD_DIR, 'products/small'),
    path.join(UPLOAD_DIR, 'products/medium'),
    path.join(UPLOAD_DIR, 'products/large'),
    path.join(UPLOAD_DIR, 'categories'),
    path.join(UPLOAD_DIR, 'categories/thumbnails'),
    path.join(UPLOAD_DIR, 'categories/banners')
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
};

// Ensure directories on module load
ensureDirectories().catch(console.error);

/**
 * Process and save a product image in multiple sizes
 * @param {Buffer} buffer - Image buffer
 * @param {string} originalName - Original filename
 * @returns {Object} - URLs for different sizes
 */
const processProductImage = async (buffer, originalName) => {
  const id = uuidv4();
  const ext = 'webp'; // Convert all to WebP for better compression
  const baseName = `${id}`;

  const results = {};
  const sizes = IMAGE.PRODUCT_SIZES;

  // Process each size
  for (const [sizeName, dimensions] of Object.entries(sizes)) {
    const filename = `${baseName}-${sizeName}.${ext}`;
    const subDir = sizeName === 'thumbnail' ? 'thumbnails' : sizeName;
    const filepath = path.join(UPLOAD_DIR, 'products', subDir, filename);

    await sharp(buffer)
      .resize(dimensions.width, dimensions.height, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 85 })
      .toFile(filepath);

    results[sizeName] = `/uploads/products/${subDir}/${filename}`;
  }

  // Also save original (resized to max dimensions)
  const originalFilename = `${baseName}-original.${ext}`;
  const originalPath = path.join(UPLOAD_DIR, 'products', originalFilename);

  await sharp(buffer)
    .resize(2000, 2667, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 90 })
    .toFile(originalPath);

  results.original = `/uploads/products/${originalFilename}`;

  return {
    url: results.large || results.original,
    thumbnailUrl: results.thumbnail,
    sizes: results
  };
};

/**
 * Process and save a category image
 * @param {Buffer} buffer - Image buffer
 * @param {string} type - 'image' or 'banner'
 * @returns {string} - URL of processed image
 */
const processCategoryImage = async (buffer, type = 'image') => {
  const id = uuidv4();
  const ext = 'webp';

  let dimensions;
  let subDir;
  let quality;

  if (type === 'banner') {
    dimensions = IMAGE.CATEGORY_SIZES.banner;
    subDir = 'banners';
    quality = 90;
  } else {
    dimensions = IMAGE.CATEGORY_SIZES.image;
    subDir = '';
    quality = 92;
  }

  const filename = `${id}-${type}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, 'categories', subDir, filename);

  await sharp(buffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality })
    .toFile(filepath);

  const urlSubDir = subDir ? `${subDir}/` : '';
  return `/uploads/categories/${urlSubDir}${filename}`;
};

/**
 * Delete an image file
 * @param {string} imageUrl - URL of the image to delete
 */
const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // Convert URL to file path
    const relativePath = imageUrl.replace('/uploads/', '');
    const filepath = path.join(UPLOAD_DIR, relativePath);

    await fs.unlink(filepath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error deleting image:', error);
    }
  }
};

/**
 * Delete multiple product images (all sizes)
 * @param {string} baseUrl - URL of the main image
 */
const deleteProductImages = async (baseUrl) => {
  if (!baseUrl) return;

  try {
    // Extract the base ID from the URL
    const match = baseUrl.match(/([a-f0-9-]+)-(?:original|large|medium|small|thumbnail)\.webp/);
    if (!match) return;

    const baseId = match[1];
    const sizes = ['original', 'large', 'medium', 'small', 'thumbnail'];
    const subdirs = ['', 'large', 'medium', 'small', 'thumbnails'];

    for (let i = 0; i < sizes.length; i++) {
      const filename = `${baseId}-${sizes[i]}.webp`;
      const subdir = subdirs[i] || '';
      const filepath = path.join(UPLOAD_DIR, 'products', subdir, filename);

      try {
        await fs.unlink(filepath);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    }
  } catch (error) {
    console.error('Error deleting product images:', error);
  }
};

/**
 * Get image metadata
 * @param {Buffer} buffer - Image buffer
 * @returns {Object} - Image metadata
 */
const getImageMetadata = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length
  };
};

/**
 * Validate image
 * @param {Buffer} buffer - Image buffer
 * @param {string} mimetype - File mimetype
 * @returns {Object} - Validation result
 */
const validateImage = async (buffer, mimetype) => {
  const errors = [];

  // Check mime type
  if (!IMAGE.ALLOWED_TYPES.includes(mimetype)) {
    errors.push(`Invalid file type. Allowed: ${IMAGE.ALLOWED_TYPES.join(', ')}`);
  }

  // Check file size
  if (buffer.length > IMAGE.MAX_SIZE) {
    errors.push(`File too large. Maximum size: ${IMAGE.MAX_SIZE / (1024 * 1024)}MB`);
  }

  // Check if it's a valid image
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width < 100 || metadata.height < 100) {
      errors.push('Image too small. Minimum dimensions: 100x100 pixels');
    }
  } catch (err) {
    errors.push('Invalid or corrupted image file');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Optimize an existing image
 * @param {string} imageUrl - URL of the image
 * @returns {string} - URL of optimized image
 */
const optimizeImage = async (imageUrl) => {
  const relativePath = imageUrl.replace('/uploads/', '');
  const filepath = path.join(UPLOAD_DIR, relativePath);

  const buffer = await fs.readFile(filepath);
  const optimizedBuffer = await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();

  // Replace with webp version
  const newPath = filepath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  await fs.writeFile(newPath, optimizedBuffer);

  // Delete original if different
  if (newPath !== filepath) {
    await fs.unlink(filepath);
  }

  return imageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
};

module.exports = {
  processProductImage,
  processCategoryImage,
  deleteImage,
  deleteProductImages,
  getImageMetadata,
  validateImage,
  optimizeImage,
  ensureDirectories
};
