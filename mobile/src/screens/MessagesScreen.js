import React, { useEffect, useMemo, useState } from 'react';
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
import { makeShadow, useTheme } from '../theme';
import { getApiErrorMessage as apiError } from '../lib/apiError';
import { messageFilterParams, validateTicketDraft } from '../lib/userContent';

const ticketStatuses = ['all', 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
const ticketCategories = ['website_bug', 'business_issue', 'feature_request', 'account', 'other'];
const ticketPriorities = ['low', 'normal', 'high', 'urgent'];
const PAGE_SIZE = 20;

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

function MessageList({ messages, onDelete, onMarkRead, onOpen }) {
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
              <View style={styles.rowActions}>
                {!message.isRead ? (
                  <GlassButtonSurface
                    accessibilityLabel={t('messages.markRead')}
                    contentStyle={styles.iconButtonContent}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      onMarkRead(message.id);
                    }}
                    style={styles.iconButton}
                  >
                    <Ionicons color={colors.primary} name="mail-open-outline" size={20} />
                  </GlassButtonSurface>
                ) : null}
                <GlassButtonSurface
                  accessibilityLabel={t('messages.delete')}
                  contentStyle={styles.iconButtonContent}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    onDelete(message.id);
                  }}
                  style={styles.iconButton}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={20} />
                </GlassButtonSurface>
              </View>
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
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(message)}>
      <View style={styles.modalBackdrop}>
        <GlassSurface style={[styles.modalSheet, styles.messageDetailSheet]} contentStyle={[styles.modalContent, styles.messageDetailContent]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{message?.title || t('messages.detailTitle')}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(message?.createdAt)}</Text>
            </View>
            <GlassButtonSurface accessibilityLabel={t('messages.close')} contentStyle={styles.iconButtonContent} onPress={onClose} style={styles.iconButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </GlassButtonSurface>
          </View>
          <ScrollView contentContainerStyle={styles.messageDetailScrollContent} style={styles.messageDetailScroll}>
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
            contentStyle={styles.pillContent}
            onPress={() => onChange(value)}
            wrapperStyle={styles.pillWrapper}
            style={[styles.pill, active === value ? { borderColor: colors.primary, borderWidth: 1 } : null]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.pillText, { color: active === value ? colors.primary : colors.text }]}>
              {t(`${prefix}.${value}`)}
            </Text>
          </GlassPressable>
        ))}
      </View>
    </ScrollView>
  );
}

function PaginationControls({ onPageChange, pagination, prefix }) {
  const { t } = useI18n();
  const page = Number(pagination?.page || 1);
  const pages = Number(pagination?.pages || 1);
  if (!Number.isFinite(pages) || pages <= 1) {
    return null;
  }
  return (
    <View style={styles.paginationRow}>
      <SecondaryButton
        disabled={page <= 1}
        icon="chevron-back-outline"
        onPress={() => onPageChange(Math.max(1, page - 1))}
        title={t(`${prefix}.previous`)}
      />
      <Text style={styles.paginationText}>{t(`${prefix}.pageStatus`, { page, pages })}</Text>
      <SecondaryButton
        disabled={page >= pages}
        icon="chevron-forward-outline"
        onPress={() => onPageChange(Math.min(pages, page + 1))}
        title={t(`${prefix}.next`)}
      />
    </View>
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
      <GlassButtonSurface contentStyle={styles.iconButtonContent} onPress={onRemove} style={styles.iconButton}>
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
    setCategory('website_bug');
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
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              styles.ticketModalSheet,
              styles.ticketModalFrame,
              {
                backgroundColor: colors.surfaceStrong,
                borderColor: colors.border,
              },
              makeShadow(colors, colors.dark ? 0.32 : 0.16, 14),
            ]}
          >
            <View style={[styles.modalHeader, styles.ticketModalHeader]}>
              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('support.newTicket')}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t('support.newTicketSubtitle')}</Text>
              </View>
              <GlassButtonSurface accessibilityLabel={t('messages.close')} contentStyle={styles.iconButtonContent} onPress={onClose} style={styles.iconButton}>
                <Ionicons color={colors.text} name="close" size={20} />
              </GlassButtonSurface>
            </View>
            <ScrollView
              contentContainerStyle={[styles.ticketDetailContent, styles.ticketEditorContent]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.ticketDetailScroll}
            >
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TicketThreadMessage({ message }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const outgoing = message.senderRole === 'user';
  const senderRole = message.senderRole || 'user';
  const sender = message.senderName || t(`support.senderRoles.${senderRole}`);
  const avatar = (
    <View
      style={[
        styles.threadAvatar,
        { backgroundColor: outgoing ? colors.primarySoft : colors.surfaceStrong },
      ]}
    >
      <Ionicons color={outgoing ? colors.primary : colors.textMuted} name={outgoing ? 'person-outline' : 'headset-outline'} size={16} />
    </View>
  );
  const bubble = (
    <GlassListItemSurface
      contentStyle={styles.threadMessage}
      style={[
        styles.threadBubble,
        outgoing ? { borderColor: colors.primary } : null,
      ]}
    >
      <View style={[styles.threadMetaRow, outgoing ? styles.threadMetaRowOutgoing : null]}>
        <Text style={[styles.threadSender, outgoing ? styles.threadTextOutgoing : null, { color: colors.text }]}>
          {sender}
        </Text>
        <Text style={[styles.threadTime, outgoing ? styles.threadTextOutgoing : null, { color: colors.textMuted }]}>
          {displayDateTime(message.createdAt)}
        </Text>
      </View>
      <Text style={[styles.bodyText, outgoing ? styles.threadTextOutgoing : null, { color: colors.text }]}>
        {message.body}
      </Text>
      {message.attachments?.map((item) => {
        const source = item.url ? { uri: item.url, cache: 'force-cache' } : null;
        return item.isImage ? (
          <ImageLightbox key={item.id} source={source} uri={item.url} style={styles.threadImageButton}>
            <Image resizeMode="contain" source={source} style={styles.threadImage} />
          </ImageLightbox>
        ) : (
          <Text key={item.id} style={[styles.rowMeta, outgoing ? styles.threadTextOutgoing : null, { color: colors.textMuted }]}>{item.name}</Text>
        );
      })}
    </GlassListItemSurface>
  );

  return (
    <View style={[styles.threadMessageRow, outgoing ? styles.threadMessageRowOutgoing : styles.threadMessageRowIncoming]}>
      {outgoing ? bubble : avatar}
      {outgoing ? avatar : bubble}
    </View>
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
  const [selectedFeedbackUserId, setSelectedFeedbackUserId] = useState(null);

  useEffect(() => {
    setAttachment(null);
    setReply('');
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
    setRating(0);
    setComment('');
    setSelectedFeedbackUserId(null);
  }, [ticketId]);

  const ticketQuery = useQuery({
    enabled: Boolean(ticketId),
    queryFn: () => ticketApi.get(ticketId),
    queryKey: ['mobile-ticket-detail', ticketId],
  });
  const ticket = ticketQuery.data;
  const feedbackCandidates = ticket?.feedbackCandidates || [];

  useEffect(() => {
    if (!feedbackCandidates.length) {
      setSelectedFeedbackUserId(null);
      return;
    }
    setSelectedFeedbackUserId((current) => (
      feedbackCandidates.some((candidate) => candidate.id === current)
        ? current
        : feedbackCandidates[0].id
    ));
  }, [feedbackCandidates]);

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

  const canFeedback = ['resolved', 'closed'].includes(ticket?.status);
  const feedbackCandidate = feedbackCandidates.find((candidate) => candidate.id === selectedFeedbackUserId) || feedbackCandidates[0];
  const threadMessages = ticket?.messages || [];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(ticketId)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              styles.ticketModalSheet,
              styles.ticketModalFrame,
              {
                backgroundColor: colors.surfaceStrong,
                borderColor: colors.border,
              },
              makeShadow(colors, colors.dark ? 0.32 : 0.16, 14),
            ]}
          >
            <View style={[styles.modalHeader, styles.ticketModalHeader]}>
              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{ticket?.subject || t('support.ticketDetail')}</Text>
              </View>
              <GlassButtonSurface accessibilityLabel={t('messages.close')} contentStyle={styles.iconButtonContent} onPress={onClose} style={styles.iconButton}>
                <Ionicons color={colors.text} name="close" size={20} />
              </GlassButtonSurface>
            </View>
            {ticketQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
            <ScrollView
              contentContainerStyle={styles.ticketDetailContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.ticketDetailScroll}
            >
              {ticket ? (
                <View style={[styles.ticketSummary, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong }]}>
                  <View style={[styles.ticketSummaryIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons color={colors.primary} name="ticket-outline" size={22} />
                  </View>
                  <View style={styles.ticketSummaryBody}>
                    <View style={styles.ticketChipRow}>
                      <View style={[styles.ticketChip, { borderColor: colors.borderStrong }]}>
                        <Ionicons color={colors.primary} name="ellipse" size={8} />
                        <Text style={[styles.ticketChipText, { color: colors.text }]}>{t(`support.statuses.${ticket.status}`)}</Text>
                      </View>
                      <View style={[styles.ticketChip, { borderColor: colors.borderStrong }]}>
                        <Ionicons color={colors.warning} name="flag-outline" size={13} />
                        <Text style={[styles.ticketChipText, { color: colors.text }]}>{t(`support.priorities.${ticket.priority}`)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.ticketSummaryMeta, { color: colors.textMuted }]}>
                      {t('support.messagesCount', { count: threadMessages.length })}
                    </Text>
                  </View>
                </View>
              ) : null}
              {threadMessages.length > 0 ? (
                <View style={styles.conversationHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support.conversation')}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t('support.messagesCount', { count: threadMessages.length })}</Text>
                </View>
              ) : null}
              {threadMessages.map((message) => (
                <TicketThreadMessage key={message.id} message={message} />
              ))}
              {ticket && ticket.status !== 'closed' ? (
                <GlassSurface contentStyle={[styles.form, styles.compactForm]} style={styles.replyComposer}>
                  <View style={styles.panelTitleRow}>
                    <View style={[styles.panelTitleIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons color={colors.primary} name="chatbubble-ellipses-outline" size={18} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support.reply')}</Text>
                  </View>
                  <Field label={t('support.content')} multiline onChangeText={setReply} style={styles.replyTextArea} textAlignVertical="top" value={reply} />
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
                <GlassSurface contentStyle={[styles.form, styles.compactForm]} style={styles.feedbackPanel}>
                  <View style={styles.panelTitleRow}>
                    <View style={[styles.panelTitleIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support.feedbackTitle')}</Text>
                  </View>
                  {feedbackCandidates.length > 1 ? (
                    <View style={styles.list}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>{t('support.feedbackResponder')}</Text>
                      {feedbackCandidates.map((candidate) => (
                        <GlassPressable
                          key={candidate.id}
                          onPress={() => setSelectedFeedbackUserId(candidate.id)}
                          style={[
                            styles.feedbackCandidateRow,
                            selectedFeedbackUserId === candidate.id ? { borderColor: colors.primary, borderWidth: 1 } : null,
                          ]}
                        >
                          <Text style={[styles.rowTitle, { color: colors.text }]}>
                            {candidate.name || candidate.username || candidate.email || `#${candidate.id}`}
                          </Text>
                        </GlassPressable>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <GlassButtonSurface
                        key={value}
                        contentStyle={styles.starButtonContent}
                        onPress={() => setRating(value)}
                        onPressIn={() => setRating(value)}
                        style={styles.starButton}
                      >
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
          </View>
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
  const [messagePage, setMessagePage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [showTicketEditor, setShowTicketEditor] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketStatus, setTicketStatus] = useState('all');
  const [view, setView] = useState('messages');

  useEffect(() => {
    setMessagePage(1);
  }, [messageFilter]);

  useEffect(() => {
    setTicketPage(1);
  }, [ticketStatus]);

  const messageParams = useMemo(() => (
    { ...messageFilterParams(messageFilter), limit: PAGE_SIZE, page: messagePage }
  ), [messageFilter, messagePage]);
  const ticketParams = useMemo(() => (
    ticketStatus === 'all'
      ? { limit: PAGE_SIZE, page: ticketPage }
      : { limit: PAGE_SIZE, page: ticketPage, status: ticketStatus }
  ), [ticketPage, ticketStatus]);

  const messagesQuery = useQuery({
    queryFn: () => messageApi.getMessages(messageParams),
    queryKey: ['mobile-messages', messageParams],
  });
  const unreadQuery = useQuery({
    queryFn: messageApi.getUnreadCount,
    queryKey: ['mobile-messages-unread'],
  });
  const ticketsQuery = useQuery({
    queryFn: () => ticketApi.list(ticketParams),
    queryKey: ['mobile-tickets', ticketParams],
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
  const messagePagination = messagesQuery.data?.pagination;
  const tickets = ticketsQuery.data?.tickets || [];
  const ticketPagination = ticketsQuery.data?.pagination;
  const unreadCount = Number(unreadQuery.data || messagesQuery.data?.unreadCount || 0);
  const refreshing = messagesQuery.isFetching || ticketsQuery.isFetching || unreadQuery.isFetching;

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageHeader eyebrow={t('messages.eyebrow')} title={t('messages.title')} subtitle={t('messages.subtitle')} />
        <View
          style={[
            styles.section,
            styles.sectionPanel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            makeShadow(colors, colors.dark ? 0.28 : 0.12, 10),
          ]}
        >
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
              <MessageList
                messages={messages}
                onDelete={(id) => deleteMutation.mutate(id)}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onOpen={openMessage}
              />
              <PaginationControls onPageChange={setMessagePage} pagination={messagePagination} prefix="messages" />
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
              <PaginationControls onPageChange={setTicketPage} pagination={ticketPagination} prefix="support" />
            </>
          )}
        </View>
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
  compactForm: {
    gap: 11,
    paddingBottom: 4,
  },
  container: {
    gap: 16,
    padding: 18,
    paddingBottom: 110,
  },
  conversationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
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
    borderRadius: 999,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 0,
    width: 44,
  },
  iconButtonContent: {
    alignItems: 'center',
    flex: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    maxHeight: '84%',
    padding: 16,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  messageDetailContent: {
    maxHeight: '100%',
  },
  messageDetailScroll: {
    flexGrow: 0,
    maxHeight: 520,
  },
  messageDetailScrollContent: {
    paddingBottom: 4,
  },
  messageDetailSheet: {
    maxHeight: '92%',
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
    minHeight: 42,
    paddingHorizontal: 14,
  },
  pillContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pillWrapper: {
    alignSelf: 'flex-start',
  },
  pills: {
    flexDirection: 'row',
    gap: 9,
    paddingRight: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 17,
    minWidth: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  feedbackPanel: {
    borderRadius: 22,
  },
  feedbackCandidateRow: {
    borderRadius: 16,
    padding: 12,
  },
  panelTitleIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  panelTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  paginationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  replyComposer: {
    borderRadius: 22,
  },
  replyTextArea: {
    minHeight: 88,
    paddingTop: 12,
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
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
  sectionPanel: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  starButton: {
    borderRadius: 999,
    height: 48,
    minHeight: 48,
    paddingHorizontal: 0,
    width: 48,
  },
  starButtonContent: {
    alignItems: 'center',
    flex: 0,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  stars: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'space-between',
  },
  textArea: {
    minHeight: 116,
    paddingTop: 14,
  },
  threadBubble: {
    borderRadius: 20,
    maxWidth: '82%',
  },
  threadAvatar: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    marginTop: 4,
    width: 32,
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
    gap: 9,
    padding: 13,
  },
  threadMessageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    width: '100%',
  },
  threadMessageRowIncoming: {
    justifyContent: 'flex-start',
  },
  threadMessageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  threadMetaRow: {
    alignItems: 'flex-start',
    gap: 2,
  },
  threadMetaRowOutgoing: {
    alignItems: 'flex-end',
  },
  threadSender: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },
  threadTime: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  threadTextOutgoing: {
    textAlign: 'right',
  },
  ticketDetailContent: {
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 2,
  },
  ticketDetailScroll: {
    flexGrow: 0,
  },
  ticketEditorContent: {
    gap: 13,
    paddingTop: 12,
  },
  ticketModalFrame: {
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 4,
    paddingTop: 16,
  },
  ticketModalHeader: {
    paddingHorizontal: 18,
  },
  ticketModalSheet: {
    maxHeight: '82%',
  },
  ticketChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  ticketChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  ticketChipText: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  ticketSummary: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  ticketSummaryBody: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  ticketSummaryIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  ticketSummaryMeta: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
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
