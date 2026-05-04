import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, PrimaryButton, SecondaryButton } from '../components/FormControls';
import {
  GlassButtonSurface,
  GlassListItemSurface,
  GlassPressable,
  GlassSurface,
  PageHeader,
  ScreenBackground,
  SegmentedControl,
} from '../components/Glass';
import ImageLightbox from '../components/ImageLightbox';
import TurnstileWidget from '../components/Turnstile';
import { filesApi } from '../api/files';
import { messageApi } from '../api/messages';
import { ticketApi } from '../api/tickets';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { getApiErrorMessage as apiError } from '../lib/apiError';

const { validateTicketDraft } = require('../lib/userContent');

const ticketStatuses = ['all', 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
const ticketCategories = ['website_bug', 'business_issue', 'feature_request', 'account', 'other'];
const ticketPriorities = ['low', 'normal', 'high', 'urgent'];

const displayDateTime = (value) => String(value || '').replace('T', ' ').slice(0, 16) || '--';
const messageTone = (message) => (message.isRead ? 'read' : 'unread');

function EmptyState({ icon, text }) {
  const { colors } = useTheme();
  return (
    <GlassListItemSurface contentStyle={styles.emptyState}>
      <Ionicons color={colors.textMuted} name={icon} size={30} />
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </GlassListItemSurface>
  );
}

function MessageList({ messages, onDelete, onOpen }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  if (!messages.length) {
    return <EmptyState icon="mail-open-outline" text={t('messages.empty')} />;
  }
  return (
    <View style={styles.list}>
      {messages.map((message) => {
        const tone = messageTone(message);
        return (
          <GlassPressable
            key={message.id}
            onPress={() => onOpen(message)}
            style={[styles.rowPressable, tone === 'unread' ? { borderColor: colors.primary, borderWidth: 1 } : null]}
          >
            <View style={styles.rowHeader}>
              <View style={styles.rowTitleBox}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{message.title}</Text>
                <Text numberOfLines={2} style={[styles.rowMeta, { color: colors.textMuted }]}>{message.content}</Text>
              </View>
              {!message.isRead ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.rowFooter}>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(message.createdAt)}</Text>
              <GlassButtonSurface onPress={() => onDelete(message.id)} style={styles.iconButton}>
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </GlassButtonSurface>
            </View>
          </GlassPressable>
        );
      })}
    </View>
  );
}

function MessageDetailModal({ message, onClose }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(message)}>
      <View style={styles.modalBackdrop}>
        <GlassSurface style={styles.modalSheet} contentStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{message?.title || t('messages.detailTitle')}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(message?.createdAt)}</Text>
            </View>
            <GlassButtonSurface onPress={onClose} style={styles.iconButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </GlassButtonSurface>
          </View>
          <ScrollView>
            <Text style={[styles.bodyText, { color: colors.text }]}>{message?.content || t('messages.noContent')}</Text>
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function FilterPills({ active, options, prefix, onChange }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.pills}>
        {options.map((value) => (
          <GlassPressable
            key={value}
            onPress={() => onChange(value)}
            style={[styles.pill, active === value ? { borderColor: colors.primary, borderWidth: 1 } : null]}
          >
            <Text style={[styles.pillText, { color: active === value ? colors.primary : colors.text }]}>
              {t(`${prefix}.${value}`)}
            </Text>
          </GlassPressable>
        ))}
      </View>
    </ScrollView>
  );
}

function TicketList({ onCreate, onOpen, status, tickets, setStatus }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.list}>
      <View style={styles.toolbar}>
        <FilterPills active={status} onChange={setStatus} options={ticketStatuses} prefix="support.statuses" />
        <PrimaryButton icon="add-circle-outline" onPress={onCreate} title={t('support.newTicket')} />
      </View>
      {!tickets.length ? <EmptyState icon="ticket-outline" text={t('support.empty')} /> : tickets.map((ticket) => (
        <GlassPressable key={ticket.id} onPress={() => onOpen(ticket.id)} style={styles.rowPressable}>
          <View style={styles.rowHeader}>
            <View style={styles.rowTitleBox}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{ticket.subject}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {t(`support.statuses.${ticket.status}`)} / {t(`support.priorities.${ticket.priority}`)}
              </Text>
            </View>
            <Ionicons color={colors.primary} name="chevron-forward" size={20} />
          </View>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(ticket.lastRepliedAt || ticket.createdAt)}</Text>
        </GlassPressable>
      ))}
    </View>
  );
}

function AttachmentPreview({ image, onRemove }) {
  const { colors } = useTheme();
  return (
    <GlassListItemSurface contentStyle={styles.attachmentRow}>
      <Image source={{ uri: image.uri }} style={styles.attachmentImage} />
      <Text numberOfLines={1} style={[styles.attachmentName, { color: colors.text }]}>{image.fileName || image.uri?.split('/').pop()}</Text>
      <GlassButtonSurface onPress={onRemove} style={styles.iconButton}>
        <Ionicons color={colors.danger} name="close-circle-outline" size={20} />
      </GlassButtonSurface>
    </GlassListItemSurface>
  );
}

function TicketEditorModal({ loading, onClose, onSubmit, visible }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [category, setCategory] = useState('website_bug');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const reset = () => {
    setContent('');
    setErrors({});
    setPriority('normal');
    setSubject('');
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  };

  const submit = () => {
    const nextErrors = validateTicketDraft({ content, subject });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (!turnstileToken) {
      Alert.alert(t('support.turnstileRequiredTitle'), t('support.turnstileRequired'));
      return;
    }
    onSubmit({
      category,
      content: content.trim(),
      priority,
      subject: subject.trim(),
      cf_turnstile_response: turnstileToken,
    }, reset);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
        <View style={styles.modalBackdrop}>
          <GlassSurface style={styles.modalSheet} contentStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('support.newTicket')}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t('support.newTicketSubtitle')}</Text>
              </View>
              <GlassButtonSurface onPress={onClose} style={styles.iconButton}>
                <Ionicons color={colors.text} name="close" size={20} />
              </GlassButtonSurface>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Field error={errors.subject ? t(errors.subject) : null} label={t('support.subject')} onChangeText={setSubject} value={subject} />
              <Field
                error={errors.content ? t(errors.content) : null}
                label={t('support.content')}
                multiline
                onChangeText={setContent}
                style={styles.textArea}
                textAlignVertical="top"
                value={content}
              />
              <Text style={[styles.formLabel, { color: colors.text }]}>{t('support.category')}</Text>
              <FilterPills active={category} onChange={setCategory} options={ticketCategories} prefix="support.categories" />
              <Text style={[styles.formLabel, { color: colors.text }]}>{t('support.priority')}</Text>
              <FilterPills active={priority} onChange={setPriority} options={ticketPriorities} prefix="support.priorities" />
              <TurnstileWidget
                resetKey={turnstileResetKey}
                onError={() => setTurnstileToken('')}
                onExpire={() => setTurnstileToken('')}
                onVerify={setTurnstileToken}
              />
              <PrimaryButton loading={loading} onPress={submit} title={t('support.submitTicket')} />
            </ScrollView>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TicketDetailModal({ ticketId, onClose }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [attachment, setAttachment] = useState(null);
  const [reply, setReply] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const ticketQuery = useQuery({
    enabled: Boolean(ticketId),
    queryFn: () => ticketApi.get(ticketId),
    queryKey: ['mobile-ticket-detail', ticketId],
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      let attachments = [];
      if (attachment) {
        const uploaded = await filesApi.uploadImage({
          entityType: 'support_ticket_message',
          image: attachment,
        });
        const filePath = uploaded.file_path || uploaded.path || uploaded.result?.file_path;
        attachments = filePath ? [filePath] : [];
      }
      return ticketApi.reply(ticketId, {
        attachments,
        content: reply.trim(),
        cf_turnstile_response: turnstileToken,
      });
    },
    onError: (error) => Alert.alert(t('support.replyFailed'), apiError(error, t('support.replyFailed'))),
    onSuccess: () => {
      setAttachment(null);
      setReply('');
      setTurnstileToken('');
      setTurnstileResetKey((value) => value + 1);
      queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['mobile-tickets'] });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ ratedUserId }) => ticketApi.submitFeedback(ticketId, { rated_user_id: ratedUserId, rating, comment }),
    onError: (error) => Alert.alert(t('support.feedbackFailed'), apiError(error, t('support.feedbackFailed'))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail', ticketId] });
    },
  });

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('record.photoPermissionTitle'), t('record.photoPermissionMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAttachment(result.assets[0]);
    }
  };

  const submitReply = () => {
    if (!reply.trim()) {
      Alert.alert(t('support.replyFailed'), t('support.validation.contentRequired'));
      return;
    }
    if (!turnstileToken) {
      Alert.alert(t('support.turnstileRequiredTitle'), t('support.turnstileRequired'));
      return;
    }
    replyMutation.mutate();
  };

  const ticket = ticketQuery.data;
  const canFeedback = ['resolved', 'closed'].includes(ticket?.status);
  const feedbackCandidate = ticket?.feedbackCandidates?.[0];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(ticketId)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
        <View style={styles.modalBackdrop}>
          <GlassSurface style={styles.modalSheet} contentStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{ticket?.subject || t('support.ticketDetail')}</Text>
                {ticket ? (
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {t(`support.statuses.${ticket.status}`)} / {t(`support.priorities.${ticket.priority}`)}
                  </Text>
                ) : null}
              </View>
              <GlassButtonSurface onPress={onClose} style={styles.iconButton}>
                <Ionicons color={colors.text} name="close" size={20} />
              </GlassButtonSurface>
            </View>
            {ticketQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {ticket?.messages?.map((message) => (
                <GlassListItemSurface key={message.id} contentStyle={styles.threadMessage}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{message.senderName || t(`support.senderRoles.${message.senderRole}`)}</Text>
                  <Text style={[styles.bodyText, { color: colors.text }]}>{message.body}</Text>
                  {message.attachments?.map((item) => (
                    item.isImage ? (
                      <ImageLightbox key={item.id} uri={item.url} title={item.name} style={styles.threadImageButton}>
                        <Image source={{ uri: item.url }} style={styles.threadImage} />
                      </ImageLightbox>
                    ) : (
                      <Text key={item.id} style={[styles.rowMeta, { color: colors.textMuted }]}>{item.name}</Text>
                    )
                  ))}
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(message.createdAt)}</Text>
                </GlassListItemSurface>
              ))}
              {ticket && ticket.status !== 'closed' ? (
                <GlassSurface contentStyle={styles.form}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support.reply')}</Text>
                  <Field label={t('support.content')} multiline onChangeText={setReply} style={styles.textArea} textAlignVertical="top" value={reply} />
                  {attachment ? <AttachmentPreview image={attachment} onRemove={() => setAttachment(null)} /> : null}
                  <SecondaryButton icon="image-outline" onPress={pickAttachment} title={t('support.addImage')} />
                  <TurnstileWidget
                    resetKey={turnstileResetKey}
                    onError={() => setTurnstileToken('')}
                    onExpire={() => setTurnstileToken('')}
                    onVerify={setTurnstileToken}
                  />
                  <PrimaryButton loading={replyMutation.isPending} onPress={submitReply} title={t('support.submitReply')} />
                </GlassSurface>
              ) : null}
              {canFeedback && feedbackCandidate ? (
                <GlassSurface contentStyle={styles.form}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support.feedbackTitle')}</Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <GlassButtonSurface key={value} onPress={() => setRating(value)} style={styles.starButton}>
                        <Ionicons color={value <= rating ? colors.warning : colors.textMuted} name={value <= rating ? 'star' : 'star-outline'} size={24} />
                      </GlassButtonSurface>
                    ))}
                  </View>
                  <Field label={t('support.feedbackComment')} onChangeText={setComment} value={comment} />
                  <PrimaryButton
                    disabled={!rating}
                    loading={feedbackMutation.isPending}
                    onPress={() => feedbackMutation.mutate({ ratedUserId: feedbackCandidate.id })}
                    title={t('support.submitFeedback')}
                  />
                </GlassSurface>
              ) : null}
            </ScrollView>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [messageFilter, setMessageFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [showTicketEditor, setShowTicketEditor] = useState(false);
  const [ticketStatus, setTicketStatus] = useState('all');
  const [view, setView] = useState('messages');

  const messageParams = useMemo(() => (
    messageFilter === 'unread' ? { read_status: 'unread' } : {}
  ), [messageFilter]);

  const messagesQuery = useQuery({
    queryFn: () => messageApi.getMessages(messageParams),
    queryKey: ['mobile-messages', messageParams],
  });
  const unreadQuery = useQuery({
    queryFn: messageApi.getUnreadCount,
    queryKey: ['mobile-messages-unread'],
  });
  const ticketsQuery = useQuery({
    queryFn: () => ticketApi.list(ticketStatus === 'all' ? { limit: 20 } : { limit: 20, status: ticketStatus }),
    queryKey: ['mobile-tickets', ticketStatus],
  });

  const markReadMutation = useMutation({
    mutationFn: messageApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-messages'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-messages-unread'] });
    },
  });
  const markAllMutation = useMutation({
    mutationFn: messageApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-messages'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-messages-unread'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: messageApi.deleteMessage,
    onError: (error) => Alert.alert(t('messages.deleteFailed'), apiError(error, t('messages.deleteFailed'))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-messages'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-messages-unread'] });
    },
  });
  const createTicketMutation = useMutation({
    mutationFn: ticketApi.create,
    onError: (error) => Alert.alert(t('support.createFailed'), apiError(error, t('support.createFailed'))),
    onSuccess: (ticket) => {
      setShowTicketEditor(false);
      setSelectedTicketId(ticket.id);
      queryClient.invalidateQueries({ queryKey: ['mobile-tickets'] });
    },
  });

  const refresh = () => {
    messagesQuery.refetch();
    unreadQuery.refetch();
    ticketsQuery.refetch();
  };

  const openMessage = (message) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markReadMutation.mutate(message.id);
    }
  };

  const messages = messagesQuery.data?.messages || [];
  const tickets = ticketsQuery.data?.tickets || [];
  const unreadCount = Number(unreadQuery.data || messagesQuery.data?.unreadCount || 0);
  const refreshing = messagesQuery.isFetching || ticketsQuery.isFetching || unreadQuery.isFetching;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageHeader eyebrow={t('messages.eyebrow')} title={t('messages.title')} subtitle={t('messages.subtitle')} />
        <GlassSurface contentStyle={styles.section}>
          <SegmentedControl
            onChange={setView}
            options={[
              { label: `${t('messages.tabMessages')}${unreadCount ? ` ${unreadCount}` : ''}`, value: 'messages' },
              { label: t('messages.tabTickets'), value: 'tickets' },
            ]}
            value={view}
          />
          {view === 'messages' ? (
            <>
              <View style={styles.toolbar}>
                <FilterPills active={messageFilter} onChange={setMessageFilter} options={['all', 'unread']} prefix="messages.filters" />
                <SecondaryButton
                  disabled={unreadCount === 0 || markAllMutation.isPending}
                  icon="mail-open-outline"
                  onPress={() => markAllMutation.mutate()}
                  title={t('messages.markAllRead')}
                />
              </View>
              {messagesQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              <MessageList messages={messages} onDelete={(id) => deleteMutation.mutate(id)} onOpen={openMessage} />
            </>
          ) : (
            <>
              {ticketsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              <TicketList
                onCreate={() => setShowTicketEditor(true)}
                onOpen={setSelectedTicketId}
                setStatus={setTicketStatus}
                status={ticketStatus}
                tickets={tickets}
              />
            </>
          )}
        </GlassSurface>
      </ScrollView>
      <MessageDetailModal message={selectedMessage} onClose={() => setSelectedMessage(null)} />
      <TicketEditorModal
        loading={createTicketMutation.isPending}
        onClose={() => setShowTicketEditor(false)}
        onSubmit={(payload, reset) => createTicketMutation.mutate(payload, { onSuccess: reset })}
        visible={showTicketEditor}
      />
      <TicketDetailModal ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  attachmentImage: {
    borderRadius: 12,
    height: 46,
    width: 46,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  attachmentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 23,
  },
  container: {
    gap: 16,
    padding: 18,
    paddingBottom: 110,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    padding: 26,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  form: {
    gap: 13,
    paddingBottom: 18,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  list: {
    gap: 11,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    gap: 14,
    maxHeight: '88%',
    padding: 18,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 28,
  },
  modalTitleBox: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  pill: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  pills: {
    flexDirection: 'row',
    gap: 9,
    paddingRight: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowPressable: {
    borderRadius: 18,
    padding: 14,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },
  rowTitleBox: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  starButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
  },
  textArea: {
    minHeight: 116,
    paddingTop: 14,
  },
  threadImage: {
    aspectRatio: 1.5,
    borderRadius: 14,
    width: '100%',
  },
  threadImageButton: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  threadMessage: {
    gap: 8,
    padding: 12,
  },
  toolbar: {
    gap: 11,
  },
  unreadDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 5,
    width: 10,
  },
});
