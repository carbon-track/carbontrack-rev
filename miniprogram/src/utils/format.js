export const formatNumber = (value, digits = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return digits > 0 ? (0).toFixed(digits) : '0';
  }
  return digits > 0 ? parsed.toFixed(digits) : String(Math.round(parsed));
};

export const formatDate = (value) => {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
};

export const getRecordTitle = (record) => (
  record?.activity_name_zh
  || record?.activity_name
  || record?.activity_name_en
  || record?.name_zh
  || record?.name
  || '低碳记录'
);

export const getProductImage = (product) => {
  const images = product?.images || product?.current_product_images;
  if (Array.isArray(images) && images.length > 0) {
    return images[0]?.public_url || images[0]?.url || images[0];
  }
  return product?.image_url || product?.cover_url || product?.product_image_url || '';
};

export const statusText = (status) => {
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '未通过',
    completed: '已完成',
    processing: '处理中',
    cancelled: '已取消',
  };
  return map[status] || status || '未知';
};
