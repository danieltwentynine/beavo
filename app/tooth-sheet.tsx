import { router, useLocalSearchParams } from 'expo-router';
import { Trash } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { formatEventDate, toothName } from '@/components/teeth/toothName';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { ParentalGate } from '@/components/ui/ParentalGate';
import { useActiveChild } from '@/hooks/useActiveChild';
import { useCategories } from '@/hooks/useCategories';
import { useToothEvents } from '@/hooks/useToothEvents';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { background } from '@/src/data/firestore';
import { localDate } from '@/src/data/schedule';
import { isPrimaryTooth, isValidEventDate, newestFirst } from '@/src/data/teeth';
import { addToothEvents, deleteToothEvent } from '@/src/data/toothEvents';
import type { ToothEventType } from '@/types';

/**
 * Form sheet for one tooth (its records + add) or several (add only, one event
 * per tooth). `?teeth=52` or `?teeth=52,74`. Anyone can read the records;
 * adding or deleting health data needs the grown-ups check (once per sheet).
 */
export default function ToothSheet() {
  const { teeth: teethParam } = useLocalSearchParams<{ teeth?: string }>();
  const teeth = useMemo(() => (teethParam ?? '').split(',').map(Number).filter(isPrimaryTooth), [teethParam]);
  const single = teeth.length === 1;

  const uid = useAuthStore(ownerIdOf);
  const { child } = useActiveChild();
  const events = useToothEvents();
  const categories = useCategories();

  const [formType, setFormType] = useState<ToothEventType | null>(single ? null : 'symptom');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const today = localDate(new Date());
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  // What to do once the grown-ups check passes. Batch logging opens straight into the form, so it starts gated.
  const [pending, setPending] = useState<{ add: ToothEventType } | { deleteId: string } | null>(
    single ? null : { add: 'symptom' },
  );

  if (!uid || !child || teeth.length === 0) return null;
  const childId = child.id;

  const toothEvents = single ? newestFirst(events.filter((e) => e.fdi === teeth[0])) : [];
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
  const typeCategories = categories.filter((c) => c.type === formType);

  const openForm = (type: ToothEventType) => {
    setFormType(type);
    setCategoryId(null);
    setError(null);
  };

  const startForm = (type: ToothEventType) => (unlocked ? openForm(type) : setPending({ add: type }));

  const save = () => {
    if (!formType) return;
    if (!categoryId || !typeCategories.some((c) => c.id === categoryId)) {
      setError(t('event.errCategory'));
      return;
    }
    if (!isValidEventDate(date, today)) {
      setError(t('event.errDate'));
      return;
    }
    background(
      addToothEvents(
        db,
        uid,
        childId,
        teeth.map((fdi) => ({ fdi, type: formType, categoryId, note: note.trim(), date })),
      ),
    );
    if (single) {
      setFormType(null);
      setNote('');
      setDate(today);
    } else {
      router.back();
    }
  };

  const deleteEvent = (eventId: string) =>
    Alert.alert(t('event.deleteTitle'), undefined, [
      { text: t('event.keep'), style: 'cancel' },
      {
        text: t('event.deleteConfirm'),
        style: 'destructive',
        onPress: () => background(deleteToothEvent(db, uid, childId, eventId)),
      },
    ]);

  return (
    <GlassSurface style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, rowGap: 14 }} keyboardShouldPersistTaps="handled">
          <Text className="font-display" style={{ fontSize: 24, color: tokens.textPrimary }}>
            {single ? toothName(teeth[0]) : t('event.logForTeeth', { count: teeth.length })}
          </Text>

          {!single && !unlocked ? null : single && !formType ? (
            <>
              <Text className="font-display-semi" style={{ fontSize: 17, color: tokens.textPrimary }}>
                {t('event.records')}
              </Text>
              {toothEvents.length === 0 ? (
                <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
                  {t('event.none')}
                </Text>
              ) : (
                toothEvents.map((e) => (
                  <Card key={e.id} padding={14} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
                    <View style={{ flex: 1, rowGap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                        <Badge
                          label={t(e.type === 'symptom' ? 'event.symptom' : 'event.treatment')}
                          tone={e.type === 'symptom' ? 'warning' : 'primary'}
                        />
                        <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
                          {formatEventDate(e.date)}
                        </Text>
                      </View>
                      <Text className="font-body-semi" style={{ fontSize: 16, color: tokens.textPrimary }}>
                        {categoryName(e.categoryId)}
                      </Text>
                      {e.note ? (
                        <Text className="font-body" style={{ fontSize: 15, color: tokens.textSecondary }}>
                          {e.note}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('event.delete', { date: formatEventDate(e.date) })}
                      onPress={() => (unlocked ? deleteEvent(e.id) : setPending({ deleteId: e.id }))}
                      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash size={22} color={tokens.textSecondary} weight="bold" />
                    </Pressable>
                  </Card>
                ))
              )}
              <Button label={t('event.addSymptom')} onPress={() => startForm('symptom')} />
              <Button label={t('event.addTreatment')} variant="outline" onPress={() => startForm('treatment')} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', columnGap: 10 }}>
                <Chip
                  label={t('event.symptom')}
                  selected={formType === 'symptom'}
                  onPress={() => startForm('symptom')}
                  style={{ flex: 1 }}
                />
                <Chip
                  label={t('event.treatment')}
                  selected={formType === 'treatment'}
                  onPress={() => startForm('treatment')}
                  style={{ flex: 1 }}
                />
              </View>

              <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textPrimary }}>
                {t('event.category')}
              </Text>
              {typeCategories.length === 0 ? (
                <Text className="font-body" style={{ fontSize: 15, color: tokens.textSecondary }}>
                  {t('event.noCategories')}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {typeCategories.map((c) => (
                    <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                  ))}
                </View>
              )}

              <Input label={t('event.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
              <Input
                label={t('event.date')}
                value={date}
                onChangeText={setDate}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />

              {error ? (
                <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textPrimary }}>
                  {error}
                </Text>
              ) : null}

              <Button label={t('event.save')} size="lg" onPress={save} />
              <Button label={t('event.back')} variant="ghost" onPress={() => (single ? setFormType(null) : router.back())} />
            </>
          )}
        </ScrollView>

        <ParentalGate
          visible={pending !== null}
          onPass={() => {
            const action = pending;
            setPending(null);
            setUnlocked(true);
            if (action && 'add' in action) openForm(action.add);
            else if (action) deleteEvent(action.deleteId);
          }}
          onCancel={() => {
            setPending(null);
            if (!single) router.back();
          }}
        />
      </KeyboardAvoidingView>
    </GlassSurface>
  );
}
