// 通用数值格式化，支持 null/undefined/字符串/NaN，默认两位小数
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(decimals);
}

// 专用于 kg CO2e 显示
export function formatKg(value, decimals = 2) {
  const n = formatNumber(value, decimals);
  return n ? `${n} kg CO₂` : '';
}
import { format } from 'date-fns';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// 解析多种输入的日期：Date | number(秒/毫秒) | string(ISO 或 "YYYY-MM-DD HH:mm:ss")
export function parseDateFlexible(input) {
  if (input === null || input === undefined || input === '') return null;

  // 已是 Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // 数字或数字字符串：判断是秒还是毫秒
  const tryNumber = (val) => {
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(n)) return null;
    // 小于阈值认为是秒（阈值取 10^12，约 2001-09-09 09:46:40 毫秒边界）
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  };

  if (typeof input === 'number' || (typeof input === 'string' && /^\d+$/.test(input.trim()))) {
    const d = tryNumber(input);
    if (d) return d;
  }

  if (typeof input === 'string') {
    const s = input.trim();
    // 替换空格为 T，提升解析兼容性："YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
    const normalized = s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
    const d1 = new Date(normalized);
    if (!isNaN(d1.getTime())) return d1;

    // 回退：仅日期的情况 "YYYY-MM-DD"
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}

// 安全格式化日期，失败返回 fallback（默认空字符串）
export function formatDateSafe(input, pattern = 'yyyy-MM-dd', fallback = '') {
  const d = parseDateFlexible(input);
  if (!d) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
}
