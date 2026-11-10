import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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
import { auth } from '@/lib/firebase';
import { tokens } from '@/lib/tokens';

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Please tell us your name'),
    email: z.string().trim().email("That email address doesn't look right"),
    password: z.string().min(8, 'Your password needs at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: "The passwords don't match",
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function registrationErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try logging in instead.';
      case 'auth/invalid-email':
        return "That email address doesn't look right. Please check it.";
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 8 characters).';
      case 'auth/network-request-failed':
        return 'No connection. Please check your internet and try again.';
    }
  }
  return "We couldn't create your account right now. Please try again.";
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
      // update must not strand the user behind a "couldn't create account"
      // error (retrying would then hit email-already-in-use). users/{uid} is
      // written at consent, which the root redirect sends them to next.
      try {
        await updateProfile(credential.user, { displayName });
      } catch {
        // Best-effort: the display name can be filled in later.
      }
      router.replace('/');
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

          <Text className="font-display text-3xl text-ink">Welcome to Beavo</Text>
          <Text className="mb-6 mt-1.5 font-body text-base text-muted">
            Create your parent account to start your child's brushing adventure.
          </Text>

          <View style={{ rowGap: 16 }}>
            <FormField
              control={control}
              name="displayName"
              label="Your name"
              placeholder="e.g. Maria"
              autoCapitalize="words"
              icon={<User size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="email"
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<EnvelopeSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="password"
              label="Password"
              placeholder="At least 8 characters"
              autoCapitalize="none"
              secureTextEntry
              icon={<LockSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
            <FormField
              control={control}
              name="confirmPassword"
              label="Confirm password"
              placeholder="Type it again"
              autoCapitalize="none"
              secureTextEntry
              icon={<LockSimple size={20} color={tokens.textTertiary} weight="bold" />}
            />
          </View>

          {submitError ? (
            <Text className="mt-4 font-body-semi text-sm text-danger">{submitError}</Text>
          ) : null}

          <Button
            label="Create account"
            size="lg"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            style={{ marginTop: 20 }}
          />

          <View className="mt-4 flex-row justify-center">
            <Text className="font-body text-muted">Already have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text className="font-display-semi text-text-link">Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
