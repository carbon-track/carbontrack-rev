import { useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, Input, Picker, Text, View } from '@tarojs/components';
import { rewardsApi } from '../../api/rewards';
import { getErrorMessage } from '../../api/client';
import { getSession, redirectToLogin } from '../../store/session';
import { formatDate, formatNumber, getProductImage, statusText } from '../../utils/format';
import './index.css';

const categoryLabel = (item) => item?.name || item?.label || item?.category || String(item || '');
const categoryValue = (item) => item?.category || item?.value || item?.id || String(item || '');

export default function StorePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [exchanges, setExchanges] = useState([]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchangingId, setExchangingId] = useState('');
  const [error, setError] = useState('');

  const categoryOptions = useMemo(() => ['全部', ...categories.map(categoryLabel)], [categories]);
  const selectedCategory = categoryIndex > 0 ? categories[categoryIndex - 1] : null;

  const load = async () => {
    if (!getSession().isAuthenticated) {
      redirectToLogin();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = selectedCategory ? { category: categoryValue(selectedCategory) } : {};
      const [productResult, nextCategories, exchangeResult] = await Promise.all([
        rewardsApi.getProducts(params),
        rewardsApi.getCategories(),
        rewardsApi.getExchangeTransactions({ limit: 5 }),
      ]);
      setProducts(productResult.products);
      setCategories(nextCategories);
      setExchanges(exchangeResult.exchanges);
    } catch (err) {
      setError(getErrorMessage(err, '商城数据加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(load);

  const handleCategoryChange = (event) => {
    setCategoryIndex(Number(event.detail.value));
  };

  const handleExchange = async (product) => {
    const confirm = await Taro.showModal({
      title: '确认兑换',
      content: `兑换 ${product.name} 需要 ${formatNumber(product.points_required)} 积分。`,
    });
    if (!confirm.confirm) {
      return;
    }

    setExchangingId(String(product.id));
    setError('');
    try {
      await rewardsApi.exchangeProduct({
        product_id: product.id,
        quantity: 1,
        delivery_address: address.trim() || undefined,
        contact_phone: phone.trim() || undefined,
      });
      Taro.showToast({ title: '兑换成功', icon: 'success' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '兑换失败'));
    } finally {
      setExchangingId('');
    }
  };

  return (
    <View className="page store-page">
      <View className="home-header">
        <Text className="page-title">积分商城</Text>
        <Button className="small-button" loading={loading} onClick={load}>刷新</Button>
      </View>
      {error ? <Text className="error">{error}</Text> : null}

      <View className="store-controls">
        <Picker range={categoryOptions} value={categoryIndex} onChange={handleCategoryChange}>
          <View className="picker-field">分类：{categoryOptions[categoryIndex] || '全部'}</View>
        </Picker>
        <Input className="field" placeholder="收货地址（可选）" value={address} onInput={(event) => setAddress(event.detail.value)} />
        <Input className="field" placeholder="联系电话（可选）" value={phone} onInput={(event) => setPhone(event.detail.value)} />
      </View>

      <View className="product-list">
        {products.length === 0 ? (
          <View className="empty">暂无可兑换商品</View>
        ) : products.map((product) => {
          const image = getProductImage(product);
          return (
            <View key={product.id} className="product-card">
              {image ? <Image className="product-image" src={image} mode="aspectFill" /> : <View className="product-image placeholder-image">CT</View>}
              <View className="product-body">
                <Text className="product-name">{product.name}</Text>
                <Text className="item-meta">库存 {product.stock === -1 ? '不限' : product.stock ?? '-'}</Text>
                <View className="product-footer">
                  <Text className="item-points">{formatNumber(product.points_required)} 积分</Text>
                  <Button className="exchange-button" loading={exchangingId === String(product.id)} onClick={() => handleExchange(product)}>兑换</Button>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <Text className="section-title exchange-title">兑换记录</Text>
      <View className="list">
        {exchanges.length === 0 ? (
          <View className="empty">暂无兑换记录</View>
        ) : exchanges.map((item) => (
          <View key={item.id} className="list-item">
            <View>
              <Text className="item-title">{item.product_name || '兑换商品'}</Text>
              <Text className="item-meta">{formatDate(item.created_at)} · {statusText(item.status)}</Text>
            </View>
            <Text className="item-points">-{formatNumber(item.points_used || item.total_points)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
