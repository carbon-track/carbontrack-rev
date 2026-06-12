import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { GlassButtonSurface, GlassPressable } from './Glass';
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
  source,
  style,
  uri,
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { height, width } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const imageSource = useMemo(() => (
    source || (uri ? { uri, cache: 'force-cache' } : null)
  ), [source, uri]);

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
  const close = () => {
    setVisible(false);
    setRotation(0);
    setZoom(1);
  };
  const rotate = (step) => setRotation((value) => value + step);
  const zoomIn = () => setZoom((value) => Math.min(4, Number((value + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))));

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

      <Modal animationType="fade" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
        <View style={styles.backdrop}>
          <GlassButtonSurface
            accessibilityLabel={t('messages.close')}
            contentStyle={styles.iconButtonContent}
            effect="regular"
            onPress={close}
            style={[styles.iconButton, { backgroundColor: colors.surfaceStrong }]}
            tintColor={colors.surfaceStrong}
            wrapperStyle={styles.closeButton}
          >
            <Ionicons color={colors.text} name="close" size={22} />
          </GlassButtonSurface>

          <ScrollView
            alwaysBounceHorizontal={false}
            alwaysBounceVertical={false}
            centerContent
            contentContainerStyle={[styles.viewerContent, { minHeight: height, minWidth: width }]}
            maximumZoomScale={4}
            minimumZoomScale={1}
            pinchGestureEnabled
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            style={styles.viewer}
          >
            {imageSource ? (
              <Image
                resizeMode="contain"
                source={imageSource}
                style={[
                  styles.preview,
                  {
                    height: height,
                    transform: [{ rotate: `${rotation}deg` }, { scale: zoom }],
                    width: width,
                  },
                  imageStyle,
                ]}
              />
            ) : null}
          </ScrollView>

          <View style={styles.toolbar}>
            <GlassButtonSurface accessibilityLabel={t('media.zoomOut')} contentStyle={styles.toolButtonContent} effect="regular" onPress={zoomOut} style={styles.toolButton} tintColor={colors.surfaceStrong}>
              <Ionicons color={colors.text} name="remove" size={20} />
            </GlassButtonSurface>
            <GlassButtonSurface accessibilityLabel={t('media.zoomIn')} contentStyle={styles.toolButtonContent} effect="regular" onPress={zoomIn} style={styles.toolButton} tintColor={colors.surfaceStrong}>
              <Ionicons color={colors.text} name="add" size={20} />
            </GlassButtonSurface>
            <GlassButtonSurface accessibilityLabel={t('media.rotateLeft')} contentStyle={styles.toolButtonContent} effect="regular" onPress={() => rotate(-90)} style={styles.toolButton} tintColor={colors.surfaceStrong}>
              <Ionicons color={colors.text} name="return-up-back-outline" size={20} />
            </GlassButtonSurface>
            <GlassButtonSurface accessibilityLabel={t('media.rotateRight')} contentStyle={styles.toolButtonContent} effect="regular" onPress={() => rotate(90)} style={styles.toolButton} tintColor={colors.surfaceStrong}>
              <Ionicons color={colors.text} name="return-up-forward-outline" size={20} />
            </GlassButtonSurface>
            <GlassButtonSurface accessibilityLabel={t('media.saveToLibrary')} contentStyle={styles.toolButtonContent} disabled={saving} effect="regular" onPress={save} style={[styles.toolButton, styles.saveButton]} tintColor={colors.primarySoft}>
              {saving ? <ActivityIndicator color={colors.primary} /> : <Ionicons color={colors.primary} name="download-outline" size={20} />}
            </GlassButtonSurface>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    flex: 1,
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
  closeButton: {
    elevation: 30,
    position: 'absolute',
    right: 16,
    top: 54,
    zIndex: 20,
  },
  preview: {
    alignSelf: 'center',
  },
  saveButton: {
    borderColor: 'rgba(125, 245, 176, 0.7)',
  },
  toolbar: {
    bottom: 28,
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  toolButton: {
    borderRadius: 20,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 0,
    width: 44,
  },
  toolButtonContent: {
    alignItems: 'center',
    flex: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  viewer: {
    flex: 1,
  },
  viewerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
