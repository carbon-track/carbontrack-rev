import React, { useEffect, useState } from 'react';
import { getPresignedReadUrl } from '../../lib/fileAccess';

/**
 * 通用私有R2图片组件
 * props:
 *  filePath?: string  (优先: 直接的 file_path)
 *  src?: string       (已是可访问URL则使用，不再签名)
 *  alt?: string
 *  className?: string
 *  expiresIn?: number (秒)
 *  fallback?: ReactNode
 *  onError?: (err)=>void
 */
export function R2Image({ filePath, src, alt='', className='', expiresIn=600, fallback=null, onError }) {
  const [resolved, setResolved] = useState(src || '');
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (src) { setResolved(src); return; }
      if (!filePath) { setResolved(''); return; }
      try {
        const url = await getPresignedReadUrl(filePath, expiresIn);
        if (!cancelled) setResolved(url);
      } catch (e) {
        if (!cancelled) { setErr(e); onError && onError(e); }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [filePath, src, expiresIn]);

  if (err) {
    return fallback || <div className={`bg-gray-100 text-gray-400 text-xs flex items-center justify-center ${className}`}>ERR</div>;
  }
  if (!resolved) {
    return <div className={`animate-pulse bg-gray-100 ${className}`} />;
  }
  return <img src={resolved} alt={alt} className={className} />;
}

export default R2Image;
