import { ArrowLeft } from 'phosphor-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { SlotIcon } from '@/components/brushing/SlotIcon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { t, type StringKey } from '@/lib/i18n';
import { colors, size } from '@/lib/tokens';
import type { PermissionState } from '@/src/data/reminders';
import { isValidTime } from '@/src/data/schedule';

type TimeCheck = (time: string) => StringKey | undefined;

export interface ReminderRow {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  time: string;
  blockedByQuiet?: boolean;
  validateTime: TimeCheck;
}

const PERMISSION_TEXT: Record<PermissionState, StringKey> = {
  granted: 'reminders.permissionGranted',
  denied: 'reminders.permissionDenied',
  undetermined: 'reminders.permissionUndecided',
};

function TimeField({ label, accessibilityLabel = label, time, disabled, validate, onCommit }: {
  label: string;
  accessibilityLabel?: string;
  time: string;
  disabled: boolean;
  validate?: TimeCheck;
  onCommit: (time: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<StringKey>();

  function commit() {
    if (draft === null || disabled) return;
    const value = draft.trim();
    const formatted = /^\d{4}$/.test(value) ? value.slice(0, 2) + ':' + value.slice(2) : value;
    const issue = isValidTime(formatted)
      ? validate?.(formatted) : 'reminders.badTime';
    setDraft(null);
    setError(issue);
    if (!issue && formatted !== time) onCommit(formatted);
  }

  return (
    <Input label={label} accessibilityLabel={accessibilityLabel} value={draft ?? time} maxLength={5}
      editable={!disabled}
      keyboardType="numbers-and-punctuation" returnKeyType="done" autoCorrect={false}
      onChangeText={(value) => { setDraft(value); setError(undefined); }}
      onBlur={commit} error={error ? t(error) : undefined} />
  );
}

export function RemindersPanel({ rows, permission, enabled, quiet, trailExplanation, busy, error,
  onBack, onOpenSettings, onToggleEnabled, onToggle, onTime, onQuietTime }: {
  rows: readonly ReminderRow[];
  permission: PermissionState | null;
  enabled: boolean;
  quiet: { start: string; end: string } | null;
  trailExplanation?: string;
  busy: boolean;
  error?: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onToggleEnabled: (value: boolean) => void;
  onToggle: (id: string, value: boolean) => void;
  onTime: (id: string, time: string) => void;
  onQuietTime: (edge: 'start' | 'end', time: string) => void;
}) {
  const masterDisabled = busy || permission === null || (permission === 'denied' && !enabled);
  return (
    <SafeScreen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16,
          width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={onBack}
            style={{ width: size.targetMin, height: size.targetMin, justifyContent: 'center' }}>
            <ArrowLeft size={26} color={colors.inkMuted} weight="bold" />
          </Pressable>
          <Text accessibilityRole="header" className="font-display" style={{ fontSize: 28, color: colors.ink }}>
            {t('reminders.title')}
          </Text>
          <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>{t('reminders.support')}</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" className="font-body" style={{ fontSize: 16, color: colors.symptomInk }}>{error}</Text>
          ) : null}
          <Card padding={16} style={{ rowGap: 10, backgroundColor: permission === 'denied' ? colors.symptomSoft : colors.surface }}>
            <Text accessibilityRole="header" className="font-display" style={{ fontSize: 20, color: colors.ink }}>
              {t('reminders.permissionTitle')}
            </Text>
            <Text className="font-body" style={{ fontSize: 16, color: permission === 'denied' ? colors.symptomInk : colors.inkMuted }}>
              {permission === null ? t('reminders.loading') : t(PERMISSION_TEXT[permission])}
            </Text>
            {permission === 'denied' ? (
              <Button variant="outline" label={t('reminders.openSettings')} onPress={onOpenSettings} />
            ) : null}
          </Card>
          <Card padding={16}>
            <Pressable accessibilityRole="switch" accessibilityLabel={t('reminders.toggle')}
              accessibilityState={{ checked: enabled, disabled: masterDisabled }} disabled={masterDisabled}
              onPress={() => onToggleEnabled(!enabled)}
              style={{ minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: masterDisabled ? 0.6 : 1 }}>
              <Text className="font-body-semi" style={{ fontSize: 16, flex: 1, color: colors.ink }}>{t('reminders.toggle')}</Text>
              <Switch pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
                value={enabled} trackColor={{ true: colors.primary }} />
            </Pressable>
          </Card>
          {rows.length ? (
            <Card padding={16} style={{ rowGap: 12 }}>
              {rows.map((row, index) => {
                const disabled = !enabled || busy || permission === null || (permission === 'denied' && !row.enabled);
                return (
                  <View key={row.id} style={{ gap: 8, borderTopWidth: index ? 1 : 0,
                    borderTopColor: colors.line, paddingTop: index ? 12 : 0 }}>
                    <Pressable accessibilityRole="switch" accessibilityLabel={t('reminders.slotToggle', { slot: row.label })}
                      accessibilityState={{ checked: row.enabled, disabled }} disabled={disabled}
                      onPress={() => onToggle(row.id, !row.enabled)}
                      style={{ flexDirection: 'row', gap: 10, minHeight: 56, alignItems: 'center', opacity: disabled ? 0.6 : 1 }}>
                      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <SlotIcon icon={row.icon} size={26} color={row.icon === 'moon' ? colors.slotMoon : colors.slotSun} weight="fill" />
                      </View>
                      <Text className="font-body-semi" style={{ fontSize: 17, flex: 1, color: colors.ink }}>{row.label}</Text>
                      <Switch pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
                        value={row.enabled} trackColor={{ true: colors.primary }} />
                    </Pressable>
                    <TimeField label={t('reminders.slotTime')} accessibilityLabel={t('reminders.slotTimeFor', { slot: row.label })}
                    time={row.time} disabled={busy}
                      validate={row.validateTime} onCommit={(time) => onTime(row.id, time)} />
                    {row.blockedByQuiet ? (
                      <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>{t('reminders.quietConflict')}</Text>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : null}
          {quiet ? (
            <Card padding={16} style={{ rowGap: 12 }}>
              <Text accessibilityRole="header" className="font-display" style={{ fontSize: 20, color: colors.ink }}>
                {t('reminders.quietTitle')}
              </Text>
              <Text className="font-body" style={{ fontSize: 16, color: colors.inkMuted }}>
                {quiet.start === quiet.end ? t('reminders.quietOff') : t('reminders.quietWindow', quiet)}
              </Text>
              <TimeField label={t('reminders.quietStart')} time={quiet.start} disabled={busy}
                onCommit={(time) => onQuietTime('start', time)} />
              <TimeField label={t('reminders.quietEnd')} time={quiet.end} disabled={busy}
                onCommit={(time) => onQuietTime('end', time)} />
            </Card>
          ) : null}
          {trailExplanation ? (
            <Card padding={16} style={{ rowGap: 8 }}>
              <Text accessibilityRole="header" className="font-display" style={{ fontSize: 20, color: colors.ink }}>
                {t('reminders.trailTitle')}
              </Text>
              <Text className="font-body" style={{ fontSize: 16, lineHeight: 23, color: colors.inkMuted }}>{trailExplanation}</Text>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
