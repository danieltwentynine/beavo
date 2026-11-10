import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Trash } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { SLOT_ICON_IDS, SlotIcon } from '@/components/brushing/SlotIcon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useActiveChild } from '@/hooks/useActiveChild';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { radius, tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { background } from '@/src/data/firestore';
import { canRemoveSlot, currentSlots, isValidWindow, moveSlot } from '@/src/data/schedule';
import { addSlot, removeSlot, reorderSlots, updateSlot, type SlotPatch } from '@/src/data/slots';
import type { BrushingSlot } from '@/types';

function IconButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </Pressable>
  );
}

interface SlotRowProps {
  slot: BrushingSlot;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  onChange: (patch: SlotPatch) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}

/** One editable slot. Text edits commit on blur; an invalid window snaps back. */
function SlotRow({ slot, isFirst, isLast, canRemove, onChange, onMove, onRemove }: SlotRowProps) {
  const [label, setLabel] = useState(slot.label);
  const [start, setStart] = useState(slot.windowStart);
  const [end, setEnd] = useState(slot.windowEnd);
  const [timeError, setTimeError] = useState(false);

  const commitLabel = () => {
    const next = label.trim();
    if (next && next !== slot.label) onChange({ label: next });
    else setLabel(slot.label);
  };

  const commitWindow = () => {
    if (!isValidWindow(start, end)) {
      setTimeError(true);
      setStart(slot.windowStart);
      setEnd(slot.windowEnd);
      return;
    }
    setTimeError(false);
    if (start !== slot.windowStart || end !== slot.windowEnd) onChange({ windowStart: start, windowEnd: end });
  };

  const nextIcon = SLOT_ICON_IDS[(SLOT_ICON_IDS.indexOf(slot.icon) + 1) % SLOT_ICON_IDS.length];

  return (
    <Card padding={14} style={{ rowGap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('slots.icon', { label: slot.label })}
          onPress={() => onChange({ icon: nextIcon })}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.primarySoft,
          }}
        >
          <SlotIcon icon={slot.icon} size={24} color={tokens.brandPrimary} weight="fill" />
        </Pressable>
        <Input value={label} onChangeText={setLabel} onBlur={commitLabel} maxLength={40} accessibilityLabel={t('slots.label')} containerStyle={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 8 }}>
        <Input label={t('slots.start')} value={start} onChangeText={setStart} onBlur={commitWindow} maxLength={5} keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1 }} />
        <Input label={t('slots.end')} value={end} onChangeText={setEnd} onBlur={commitWindow} maxLength={5} keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1 }} />
        <IconButton label={t('slots.moveUp', { label: slot.label })} disabled={isFirst} onPress={() => onMove(-1)}>
          <ArrowUp size={22} color={tokens.textPrimary} weight="bold" />
        </IconButton>
        <IconButton label={t('slots.moveDown', { label: slot.label })} disabled={isLast} onPress={() => onMove(1)}>
          <ArrowDown size={22} color={tokens.textPrimary} weight="bold" />
        </IconButton>
        <IconButton label={t('slots.remove', { label: slot.label })} disabled={!canRemove} onPress={onRemove}>
          <Trash size={22} color={tokens.textSecondary} weight="bold" />
        </IconButton>
      </View>
      {timeError ? (
        <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
          {t('slots.errTime')}
        </Text>
      ) : null}
    </Card>
  );
}

/** Parent edits the active child's brushing slots. Writes are instant and sync when online. */
export default function SlotsScreen() {
  const user = useAuthStore((s) => s.user);
  const { child, slots } = useActiveChild();
  const current = currentSlots(slots);
  const removable = canRemoveSlot(current);

  if (!user || !child) return <SafeScreen>{null}</SafeScreen>;
  const uid = user.uid;
  const childId = child.id;

  const add = () => {
    const created = addSlot(db, uid, childId, {
      label: t('slots.newLabel'),
      icon: 'star',
      mealType: 'custom',
      windowStart: '12:00',
      windowEnd: '13:00',
      sortOrder: (current.at(-1)?.sortOrder ?? -1) + 1,
    });
    background(created.written);
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="px-6 pb-7 pt-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ rowGap: 14 }}>
          <Text className="font-display text-3xl text-ink">{t('slots.title')}</Text>
          <Text className="font-body text-base text-muted">{t('slots.subtitle', { name: child.name })}</Text>
          {current.map((slot, i) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              isFirst={i === 0}
              isLast={i === current.length - 1}
              canRemove={removable}
              onChange={(patch) => background(updateSlot(db, uid, childId, slot.id, patch))}
              onMove={(step) => background(reorderSlots(db, uid, childId, moveSlot(current, slot.id, step)))}
              onRemove={() => {
                if (!removable) return;
                void removeSlot(db, uid, childId, slot.id).then(({ written }) => background(written), () => undefined);
              }}
            />
          ))}
          {!removable ? (
            <Text className="font-body text-sm text-muted">{t('slots.minOne')}</Text>
          ) : null}
          <Button label={t('slots.add')} variant="soft" onPress={add} />
          <Button label={t('childForm.back')} variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
