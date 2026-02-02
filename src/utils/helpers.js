const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ATN-${timestamp}-${random}`;
};

const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const generateSKU = (prefix, id) => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${random}-${id.substring(0, 4).toUpperCase()}`;
};

const calculateDiscountedPrice = (basePrice, salePrice) => {
  if (salePrice && salePrice < basePrice) {
    return salePrice;
  }
  return basePrice;
};

const calculateDiscountPercentage = (basePrice, salePrice) => {
  if (!salePrice || salePrice >= basePrice) {
    return 0;
  }
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
};

const formatCurrency = (amount, currency = 'BDT') => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency
  }).format(amount);
};

const sanitizeFilename = (filename) => {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const getPaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const getSortParams = (query, allowedFields = ['createdAt', 'name', 'price']) => {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { sortBy, sortOrder };
};

module.exports = {
  generateOrderNumber,
  generateSlug,
  generateSKU,
  calculateDiscountedPrice,
  calculateDiscountPercentage,
  formatCurrency,
  sanitizeFilename,
  getPaginationParams,
  getSortParams
};
