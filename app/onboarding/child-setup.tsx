import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { AvatarPicker } from '@/components/kids/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { createChild } from '@/lib/children';
import { t } from '@/lib/i18n';
import { outline, tokens } from '@/lib/tokens';
import { ownerIdOf, useAuthStore } from '@/stores/authStore';
import { useChildStore } from '@/stores/childStore';

const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ChildSetupScreen() {
  const ownerId = useAuthStore(ownerIdOf);
  const isLocal = useAuthStore((s) => s.isLocal);
  const setActiveChild = useChildStore((s) => s.setActiveChild);

  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [avatar, setAvatar] = useState('shark');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDone = async () => {
    if (!ownerId) return;
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError(t('child.nameRequired'));
      return;
    }
    if (age === null || !AGES.includes(age)) {
      setError(t('child.ageRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const child = await createChild(ownerId, { name: trimmed, age, avatarId: avatar });
      setActiveChild(child);
      router.replace('/(tabs)/home');
    } catch {
      setError(t('child.saveFail'));
      setSaving(false);
    }
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-7 pt-1"
          keyboardShouldPersistTaps="handled"
        >
          {/* Without an account there was no step 1. */}
          {isLocal ? null : (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: tokens.surfaceMint,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 3,
                marginBottom: 10,
                ...outline,
              }}
            >
              <Text className="font-numeric" style={{ fontSize: 14, color: tokens.textLink }}>
                {t('child.step')}
              </Text>
            </View>
          )}

          <Text className="font-display text-3xl text-ink">{t('child.title')}</Text>
          <Text className="mb-5 mt-1 font-body text-base text-muted">
            {t('child.subtitle')}
          </Text>

          <View style={{ rowGap: 18, flex: 1 }}>
            <Input label={t('child.name')} placeholder={t('child.namePlaceholder')} value={name} onChangeText={setName} />

            <View>
              <Text className="mb-2 font-body-semi text-sm text-ink">{t('child.ageQuestion')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {AGES.map((a) => (
                  <Chip
                    key={a}
                    label={String(a)}
                    accessibilityLabel={t('child.ageA11y', { age: a })}
                    selected={age === a}
                    onPress={() => setAge(a)}
                    style={{ flexGrow: 1, flexBasis: '30%' }}
                  />
                ))}
              </View>
            </View>

            <View>
              <Text className="mb-2.5 font-body-semi text-sm text-ink">{t('child.pickCharacter')}</Text>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </View>
          </View>

          {error ? <Text className="mt-4 font-body-semi text-sm text-danger">{error}</Text> : null}

          <Button
            label={t('child.submit')}
            size="lg"
            onPress={onDone}
            loading={saving}
            style={{ marginTop: 22 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
