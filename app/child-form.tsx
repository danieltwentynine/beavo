import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { AVATAR_COLORS, AvatarPicker, defaultAvatarColor } from '@/components/kids/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ParentalGate } from '@/components/ui/ParentalGate';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useActiveChild } from '@/hooks/useActiveChild';
import { deleteChildProfile } from '@/lib/account';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { radius, tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { MAX_CHILDREN, createChild, updateChild } from '@/src/data/children';
import { background } from '@/src/data/firestore';

const thisYear = new Date().getFullYear();
const MIN_BIRTH_YEAR = thisYear - 18;

const formSchema = z.object({
  name: z.string().trim().min(1, t('childForm.errName')).max(40),
  birthYear: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && +v >= MIN_BIRTH_YEAR && +v <= thisYear), {
      message: t('childForm.errBirthYear', { min: MIN_BIRTH_YEAR, max: thisYear }),
    })
    .transform((v) => (v === '' ? undefined : Number(v))),
});

/**
 * Add (no `id`) or edit (`?id=`) a child profile. The first child is created
 * right after consent; adding a later child is gated in the child picker (the
 * only way here), and deleting one is gated on this screen.
 */
export default function ChildFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const uid = useAuthStore(ownerIdOf);
  const consent = useAuthStore((s) => s.consent);
  const { children, setActiveChild } = useActiveChild();
  const existing = id ? children.find((c) => c.id === id) : undefined;
  const isFirst = !id && children.length === 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.avatarIcon ?? 'shark');
  const [color, setColor] = useState(existing?.avatarColor ?? defaultAvatarColor('shark'));
  const [birthYear, setBirthYear] = useState(existing?.birthYear ? String(existing.birthYear) : '');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [gate, setGate] = useState<'delete' | null>(null);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/overview'));

  const onSave = () => {
    if (!uid) return;
    const parsed = formSchema.safeParse({ name, birthYear });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('childForm.errName'));
      return;
    }
    const input = { name: parsed.data.name, avatarIcon: icon, avatarColor: color, birthYear: parsed.data.birthYear };
    if (existing) {
      background(updateChild(db, uid, existing.id, input));
      leave();
      return;
    }
    if (children.length >= MAX_CHILDREN) {
      setError(t('childForm.limit'));
      return;
    }
    // Not awaited: works offline, and the listener shows the child at once.
    const created = createChild(db, uid, input, {
      breakfast: t('slots.breakfast'),
      lunch: t('slots.lunch'),
      dinner: t('slots.dinner'),
    });
    background(created.written);
    setActiveChild(created.id);
    if (isFirst) router.replace('/(tabs)/overview');
    else leave();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(t('childForm.deleteTitle', { name: existing.name }), t('childForm.deleteBody', { name: existing.name }), [
      { text: t('childForm.keep'), style: 'cancel' },
      {
        text: t('childForm.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const ok = await deleteChildProfile(existing.id);
          setDeleting(false);
          if (ok) leave();
          else Alert.alert(t('childForm.deleteFail'));
        },
      },
    ]);
  };

  // Deep links reach every route: no child before consent (the rules enforce it too).
  if (consent === 'needed' || consent === 'updated') return <Redirect href="/consent" />;

  return (
    <SafeScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow px-6 pb-7 pt-1" keyboardShouldPersistTaps="handled">
          <Text className="font-display text-3xl text-ink">
            {existing ? t('childForm.titleEdit') : t('childForm.titleNew')}
          </Text>
          {isFirst ? (
            <Text className="mt-1 font-body text-base text-muted">{t('childForm.subtitleFirst')}</Text>
          ) : null}

          <View style={{ rowGap: 18, marginTop: 20, flex: 1 }}>
            <Input
              label={t('childForm.name')}
              placeholder={t('childForm.namePlaceholder')}
              value={name}
              onChangeText={setName}
              maxLength={40}
            />

            <View>
              <Text className="mb-2.5 font-body-semi text-sm text-ink">{t('childForm.icon')}</Text>
              <AvatarPicker value={icon} color={color} onChange={setIcon} />
            </View>

            <View>
              <Text className="mb-2.5 font-body-semi text-sm text-ink">{t('childForm.color')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {AVATAR_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityLabel={c}
                    accessibilityState={{ selected: c === color }}
                    onPress={() => setColor(c)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.pill,
                      backgroundColor: c,
                      borderColor: c === color ? tokens.brandPrimary : tokens.line,
                      borderWidth: c === color ? 5 : 3,
                    }}
                  />
                ))}
              </View>
            </View>

            <Input
              label={t('childForm.birthYear')}
              placeholder={String(thisYear - 6)}
              value={birthYear}
              onChangeText={(v) => setBirthYear(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {error ? <Text className="mt-4 font-body-semi text-sm text-ink">{error}</Text> : null}

          <View style={{ rowGap: 12, marginTop: 22 }}>
            <Button label={existing ? t('childForm.save') : t('childForm.create')} size="lg" onPress={onSave} />
            {existing ? (
              <Button label={t('childForm.delete')} variant="outline" loading={deleting} onPress={() => setGate('delete')} />
            ) : null}
            {!isFirst ? <Button label={t('childForm.back')} variant="ghost" onPress={leave} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ParentalGate
        visible={gate === 'delete'}
        onPass={() => {
          setGate(null);
          confirmDelete();
        }}
        onCancel={() => setGate(null)}
      />
    </SafeScreen>
  );
}
