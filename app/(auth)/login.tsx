import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowLeft, EnvelopeSimple, LockSimple } from 'phosphor-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { auth } from '@/lib/firebase';
import { tokens } from '@/lib/tokens';

const loginSchema = z.object({
  email: z.string().trim().email("That email address doesn't look right"),
  password: z.string().min(1, 'Please enter your password'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return "That email or password didn't match. Please try again.";
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Please check your internet and try again.';
    }
  }
  return "We couldn't log you in right now. Please try again.";
}

export default function LoginScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const { control, handleSubmit, formState, getValues } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setSubmitError(null);
    setResetNotice(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (error) {
      setSubmitError(loginErrorMessage(error));
    }
  };

  const onForgotPassword = async () => {
    if (sendingReset) return;
    const email = getValues('email').trim();
    if (!loginSchema.shape.email.safeParse(email).success) {
      setResetNotice(null);
      setSubmitError('Enter the email you signed up with, then tap this again.');
      return;
    }
    setSubmitError(null);
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      // Never confirm whether an address has an account — that would let anyone
      // probe this screen for which parents are registered.
      if (!(error instanceof FirebaseError && error.code === 'auth/user-not-found')) {
        setSubmitError(loginErrorMessage(error));
        return;
      }
    } finally {
      setSendingReset(false);
    }
    setResetNotice(`If ${email} has a Beavo account, a reset link is on its way. Check your inbox.`);
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

          <Text className="font-display text-3xl text-ink">Welcome back</Text>
          <Text className="mb-6 mt-1.5 font-body text-base text-muted">
            Log in to keep your child's brushing adventure going.
          </Text>

          <View style={{ rowGap: 16 }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  icon={<EnvelopeSimple size={20} color={tokens.textSecondary} weight="bold" />}
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  label="Password"
                  placeholder="Your password"
                  autoCapitalize="none"
                  secureTextEntry
                  icon={<LockSimple size={20} color={tokens.textSecondary} weight="bold" />}
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                />
              )}
            />
          </View>

          <Pressable
            onPress={onForgotPassword}
            disabled={sendingReset}
            hitSlop={8}
            style={{ alignSelf: 'flex-end', marginTop: 10 }}
          >
            <Text className="font-display-semi text-sm text-text-link">
              {sendingReset ? 'Sending…' : 'Forgot my password'}
            </Text>
          </Pressable>

          {submitError ? (
            <Text className="mt-4 font-body-semi text-sm text-danger">{submitError}</Text>
          ) : null}

          {resetNotice ? (
            <Text className="mt-4 font-body-semi text-sm text-text-link">{resetNotice}</Text>
          ) : null}

          <Button
            label="Log in"
            size="lg"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            style={{ marginTop: 20 }}
          />

          <View className="mt-6 flex-row justify-center">
            <Text className="font-body text-muted">New to Beavo? </Text>
            <Pressable onPress={() => router.replace('/(auth)/register')}>
              <Text className="font-display-semi text-text-link">Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
