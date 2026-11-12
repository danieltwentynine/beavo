import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, EnvelopeSimple, LockSimple, User } from 'phosphor-react-native';
import { useState } from 'react';
import { Controller, useForm, type Control, type FieldPath } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { auth, db } from '@/lib/firebase';
import { t } from '@/lib/i18n';
import { tokens } from '@/lib/tokens';
import { useAuthStore } from '@/stores/authStore';

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, t('register.nameRequired')),
    email: z.string().trim().email(t('form.emailInvalid')),
    password: z.string().min(8, t('register.passwordShort')),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: t('register.passwordMismatch'),
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function registrationErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return t('register.err.inUse');
      case 'auth/invalid-email':
        return t('register.err.invalidEmail');
      case 'auth/weak-password':
        return t('register.err.weak');
      case 'auth/network-request-failed':
        return t('auth.err.network');
    }
  }
  return t('register.err.generic');
}

interface FormFieldProps {
  control: Control<RegisterFormValues>;
  name: FieldPath<RegisterFormValues>;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words';
  keyboardType?: KeyboardTypeOptions;
}

function FormField({ control, name, label, placeholder, icon, ...inputProps }: FormFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <Input
          label={label}
          placeholder={placeholder}
          icon={icon}
          value={value}
          onChangeText={onChange}
          error={error?.message}
          {...inputProps}
        />
      )}
    />
  );
}

export default function RegisterScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ displayName, email, password }: RegisterFormValues) => {
    setSubmitError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // The account exists and is signed in from here on — a failed profile
      // write must not strand the user behind a "couldn't create account"
      // error (retrying would then hit email-already-in-use).
      try {
        await updateProfile(credential.user, { displayName });
        await setDoc(doc(db, 'users', credential.user.uid), {
          email,
          displayName,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Best-effort: displayName/profile doc can be filled in later.
      }
      // Coming from device-only mode there is already a child on this phone:
      // home moves it into the new account instead of asking for it again.
      router.replace(useAuthStore.getState().isLocal ? '/' : '/onboarding/child-setup');
    } catch (error) {
      setSubmitError(registrationErrorMessage(error));
    }
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-7 pt-1"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{ alignSelf: 'flex-start', padding: 4, marginBottom: 6 }}
          >
            <ArrowLeft size={26} color={tokens.textSecondary} weight="bold" />
          </Pressable>

          <Text className="font-display text-3xl text-ink">{t('register.title')}</Text>
          <Text className="mb-6 mt-1.5 font-body text-base text-muted">
            {t('register.subtitle')}
          </Text>

          <View style={{ rowGap: 16 }}>
            <FormField
              control={control}
              name="displayName"
              label={t('register.name')}
              placeholder={t('register.namePlaceholder')}
              autoCapitalize="words"
              icon={<User size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="email"
              label={t('form.email')}
              placeholder={t('form.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<EnvelopeSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="password"
              label={t('form.password')}
              placeholder={t('register.passwordPlaceholder')}
              autoCapitalize="none"
              secureTextEntry
              icon={<LockSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="confirmPassword"
              label={t('register.confirm')}
              placeholder={t('register.confirmPlaceholder')}
              autoCapitalize="none"
              secureTextEntry
              icon={<LockSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
          </View>

          {submitError ? (
            <Text className="mt-4 font-body-semi text-sm text-danger">{submitError}</Text>
          ) : null}

          <Button
            label={t('register.submit')}
            size="lg"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            style={{ marginTop: 20 }}
          />

          <View className="mt-4 flex-row justify-center">
            <Text className="font-body text-muted">{t('register.haveAccount')}</Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text className="font-display-semi text-text-link">{t('register.logIn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
