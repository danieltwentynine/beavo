import { X } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveChild } from '@/hooks/useActiveChild';
import { t } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';
import { useChildStore } from '@/stores/childStore';
import { useNoticeStore } from '@/stores/noticeStore';
import { isParentContext } from '@/src/data/parentContext';

/**
 * The one place failures reach the parent (stores/noticeStore.ts): a refused
 * write, data that couldn't load, a step that needs a connection. Plain words,
 * no codes. Hidden unless a parent context is positively established (not while
 * loading, not mid profile switch, never in kid mode); the notice waits until a
 * parent is back. Mounted once in app/_layout.tsx.
 */
export function ParentNotice() {
  const notice = useNoticeStore((s) => s.notice);
  const dismiss = useNoticeStore((s) => s.dismiss);
  const { child, children } = useActiveChild();
  const loaded = useChildStore((s) => s.loaded);
  const insets = useSafeAreaInsets();
  // Shown only when a parent is positively known to be using the app (src/data/parentContext.ts).
  if (!notice || !isParentContext({ loaded, activeChild: child, childCount: children.length })) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, zIndex: 50 }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 8,
          paddingLeft: 16,
          borderRadius: radius.lg,
          backgroundColor: notice.tone === 'error' ? tokens.textPrimary : tokens.surfaceCard,
          ...cardShadow,
        }}
      >
        <Text
          className="font-body-semi"
          style={{ flex: 1, fontSize: 16, lineHeight: 22, paddingVertical: 12, color: notice.tone === 'error' ? tokens.textOnBrand : tokens.textPrimary }}
        >
          {t(notice.key)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notice.dismiss')}
          onPress={dismiss}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} color={notice.tone === 'error' ? tokens.textOnBrand : tokens.textPrimary} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}
