import { router } from 'expo-router';
import { ArrowLeft, Trash } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useCategories } from '@/hooks/useCategories';
import { db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';
import { background } from '@/src/data/firestore';
import { DEFAULT_CATEGORIES, addCategory, deleteCategory, updateCategory } from '@/src/data/toothEvents';
import type { Category, ToothEventType } from '@/types';

/** Category colors: the defaults' palette (all from Toy box tokens, none red). */
const COLORS = [...new Set(DEFAULT_CATEGORIES.map((c) => c.color))];
const nextColor = (color: string) => COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];

function CategoryRow({ uid, category }: { uid: string; category: Category }) {
  const [name, setName] = useState(category.name);
  const commit = () => {
    const next = name.trim();
    if (next && next !== category.name) background(updateCategory(db, uid, category.id, { name: next }));
    else setName(category.name);
  };
  const confirmDelete = () =>
    Alert.alert(t('categories.deleteTitle', { name: category.name }), t('categories.deleteBody'), [
      { text: t('categories.keep'), style: 'cancel' },
      { text: t('categories.deleteConfirm'), style: 'destructive', onPress: () => background(deleteCategory(db, uid, category.id)) },
    ]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('categories.color', { name: category.name })}
        onPress={() => background(updateCategory(db, uid, category.id, { color: nextColor(category.color) }))}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: category.color, borderWidth: 3, borderColor: tokens.borderStrong }} />
      </Pressable>
      <Input value={name} onChangeText={setName} onBlur={commit} maxLength={40} accessibilityLabel={category.name} containerStyle={{ flex: 1 }} />
      {category.isDefault ? (
        <Text className="font-body" style={{ width: 48, fontSize: 12, color: tokens.textTertiary, textAlign: 'center' }}>
          {t('categories.default')}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories.delete', { name: category.name })}
          onPress={confirmDelete}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash size={22} color={tokens.textSecondary} weight="bold" />
        </Pressable>
      )}
    </View>
  );
}

function TypeSection({ uid, type, title, categories }: { uid: string; type: ToothEventType; title: string; categories: Category[] }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    background(addCategory(db, uid, { name, type, color: COLORS[categories.length % COLORS.length] }).written);
    setDraft('');
  };
  return (
    <View>
      <SectionTitle>{title}</SectionTitle>
      <Card padding={12} style={{ rowGap: 8 }}>
        {categories.map((c) => (
          <CategoryRow key={c.id} uid={uid} category={c} />
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 4 }}>
          <Input placeholder={t('categories.newName')} value={draft} onChangeText={setDraft} onSubmitEditing={add} maxLength={40} containerStyle={{ flex: 1 }} />
          <Button label={t('categories.add')} size="sm" fullWidth={false} onPress={add} disabled={!draft.trim()} />
        </View>
      </Card>
    </View>
  );
}

/** Parent edits symptom/treatment categories (reached through the gate in More). Defaults can be renamed, not deleted. */
export default function CategoriesScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const categories = useCategories();
  if (!uid) return null;
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SafeScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, rowGap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ rowGap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('event.back')} onPress={() => router.back()} style={{ width: 48, height: 48, justifyContent: 'center' }}>
              <ArrowLeft size={26} color={tokens.textSecondary} weight="bold" />
            </Pressable>
            <Text className="font-display" style={{ fontSize: 28, color: tokens.textPrimary }}>
              {t('categories.title')}
            </Text>
          </View>
          <TypeSection uid={uid} type="symptom" title={t('categories.symptoms')} categories={sorted.filter((c) => c.type === 'symptom')} />
          <TypeSection uid={uid} type="treatment" title={t('categories.treatments')} categories={sorted.filter((c) => c.type === 'treatment')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
