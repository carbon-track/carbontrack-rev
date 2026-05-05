import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { GlassButtonSurface, GlassPressable, GlassSurface } from './Glass';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const extensionFromUri = (uri) => {
  const clean = String(uri || '').split('?')[0].split('#')[0];
  const match = clean.match(/\.(jpg|jpeg|png|webp|heic)$/i);
  return match ? match[0].toLowerCase() : '.jpg';
};

const localFileForSave = async (uri) => {
  if (String(uri).startsWith('file://')) {
    return uri;
  }
  const target = `${FileSystem.cacheDirectory}carbontrack-image-${Date.now()}${extensionFromUri(uri)}`;
  const result = await FileSystem.downloadAsync(uri, target);
  return result.uri;
};

export default function ImageLightbox({
  children,
  contentStyle,
  disabled,
  imageStyle,
  style,
  title,
  uri,
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = () => {
    if (uri && !disabled) {
      setVisible(true);
    }
  };

  const save = async () => {
    if (!uri || saving) {
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert(t('media.saveUnsupportedTitle'), t('media.saveUnsupportedMessage'));
      return;
    }
    setSaving(true);
    let localUri;
    let shouldDeleteLocalFile = false;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('media.permissionTitle'), t('media.permissionMessage'));
        return;
      }
      shouldDeleteLocalFile = !String(uri).startsWith('file://');
      localUri = await localFileForSave(uri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert(t('media.saveSuccessTitle'), t('media.saveSuccessMessage'));
    } catch (error) {
      Alert.alert(t('media.saveFailedTitle'), t('media.saveFailedMessage'));
    } finally {
      if (shouldDeleteLocalFile && localUri) {
        try {
          await FileSystem.deleteAsync(localUri, { idempotent: true });
        } catch {
          // Best-effort cleanup; saving already completed or reported its own error.
        }
      }
      setSaving(false);
    }
  };

  return (
    <>
      <GlassPressable
        disabled={!uri || disabled}
        effect="clear"
        onPress={open}
        style={style}
        contentStyle={contentStyle}
        tintColor={colors.primarySoft}
      >
        {children}
      </GlassPressable>

      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={styles.backdrop}>
          <GlassSurface effect="regular" style={styles.sheet} contentStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.titleBox}>
                <Text style={[styles.title, { color: colors.text }]}>{title || t('media.previewTitle')}</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('media.previewSubtitle')}</Text>
              </View>
              <GlassButtonSurface contentStyle={styles.iconButtonContent} onPress={() => setVisible(false)} style={styles.iconButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </GlassButtonSurface>
            </View>

            {uri ? <Image resizeMode="contain" source={{ uri }} style={[styles.preview, imageStyle]} /> : null}

            <View style={styles.actions}>
              <GlassButtonSurface onPress={save} disabled={saving} variant="primary">
                <View style={styles.actionContent}>
                  {saving ? <ActivityIndicator color={colors.primary} /> : <Ionicons color={colors.primary} name="download-outline" size={18} />}
                  <Text style={[styles.actionText, { color: colors.primary }]}>{t('media.saveToLibrary')}</Text>
                </View>
              </GlassButtonSurface>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '900',
  },
  actions: {
    gap: 10,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  content: {
    gap: 14,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    borderRadius: 18,
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
  preview: {
    aspectRatio: 1,
    width: '100%',
  },
  sheet: {
    borderRadius: 28,
    maxHeight: '88%',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  titleBox: {
    flex: 1,
    minWidth: 0,
  },
});
