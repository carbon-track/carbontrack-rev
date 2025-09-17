import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateSafe } from '../../lib/utils';
import { Mail, MailOpen, AlertCircle, CheckCircle, Clock, XCircle, Eye, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

export function MessageList({ messages, onRowClick, onMarkRead, onDelete }) {
  const { t } = useTranslation();

  const getStatusIcon = (is_read) => {
    if (is_read) {
      return <MailOpen className="h-4 w-4 text-gray-500" />;
    } else {
      return <Mail className="h-4 w-4 text-blue-500" />;
    }
  };
  // 当前数据库结构无 priority/type 字段，移除徽章显示

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {t('messages.subject')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {t('messages.content')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {t('messages.status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {t('messages.date')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {messages.map((message) => (
            <tr key={message.id} className={`hover:bg-gray-50 ${!message.is_read ? 'bg-blue-50' : ''}`}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {getStatusIcon(message.is_read)}
                  <span className="ml-2 text-sm font-medium text-gray-900 line-clamp-1">
                    {message.title}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 line-clamp-1">
                  {message.content?.slice(0, 120)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {message.is_read ? t('messages.read') : t('messages.unread')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDateSafe(message.created_at, 'yyyy-MM-dd HH:mm')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRowClick(message)}
                  className="mr-2"
                >
                  <Eye className="h-4 w-4 mr-1" /> {t('common.view')}
                </Button>
                {!message.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkRead(message.id)}
                    className="mr-2"
                  >
                    <MailOpen className="h-4 w-4 mr-1" /> {t('messages.markRead')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(message.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

