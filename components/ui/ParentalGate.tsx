import * as LocalAuthentication from 'expo-local-authentication';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t, type StringKey } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';
import { isLocked } from '@/src/data/pinLock';
import { isPin, useSettingsStore } from '@/stores/settingsStore';

const factor = () => 6 + Math.floor(Math.random() * 4); // 6–9: beyond a young child's times tables
const newQuestion = () => ({ a: factor(), b: factor() });

interface ParentalGateProps {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
}

type Step = 'pin' | 'owner' | 'math' | 'create' | 'confirm';
const PROMPT = { pin: 'gate.pinPrompt', create: 'gate.pinCreate', confirm: 'gate.pinConfirm' } as const;

/**
 * Grown-ups-only check: the parent's 4-digit PIN (Keychain, this phone only).
 * Choosing the PIN, the first time or after forgetting it, needs the phone's
 * own Face ID / passcode. Only a phone with no passcode falls back to a written
 * multiplication question. Wrong tries make the next one wait (src/data/pinLock);
 * never red.
 */
export function ParentalGate({ visible, onPass, onCancel }: ParentalGateProps) {
  const pin = useSettingsStore((s) => s.parentPin);
  const setParentPin = useSettingsStore((s) => s.setParentPin);
  const recordPinTry = useSettingsStore((s) => s.recordPinTry);
  // null: start from the PIN when there is one, else from confirming the phone's owner.
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const step: Step = chosenStep ?? (pin ? 'pin' : 'owner');
  const [question, setQuestion] = useState(newQuestion);
  const [value, setValue] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [message, setMessage] = useState<StringKey | null>(null);
  // iOS can't present an Alert or sheet while this modal is still animating out,
  // so a pass hides the modal first and calls onPass once it has dismissed.
  const [passed, setPassed] = useState(false);
  const passTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Calls onPass once: from onDismiss, or from a fallback timer if onDismiss never fires.
  const finishPass = () => {
    if (passTimer.current === null) return;
    clearTimeout(passTimer.current);
    passTimer.current = null;
    setPassed(false);
    onPass();
  };

  const goTo = (next: Step | null, nextMessage: StringKey | null = null) => {
    setChosenStep(next);
    setValue('');
    setMessage(nextMessage);
    setQuestion(newQuestion());
  };

  const pass = () => {
    goTo(null);
    if (Platform.OS === 'ios') {
      setPassed(true);
      passTimer.current = setTimeout(finishPass, 600); // longer than the fade-out
    } else {
      onPass();
    }
  };

  // Read at the moment of a try, so a wait that has just ended is over.
  const waiting = () => isLocked(useSettingsStore.getState().pinLock, Date.now());
  // Checks one answer (a PIN or the question) against the wrong-try wait.
  const attempt = (right: boolean, onRight: () => void, wrongMessage: StringKey) => {
    if (waiting()) return goTo(step, 'gate.locked');
    recordPinTry(!right);
    if (right) onRight();
    else goTo(step, waiting() ? 'gate.locked' : wrongMessage);
  };

  const confirmOwner = async () => {
    try {
      // A phone with no passcode can't confirm its owner: the question is all there is.
      if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) return goTo('math');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('gate.ownerPrompt'), cancelLabel: t('gate.back') });
      if (result.success) goTo('create');
    } catch {
      goTo('math');
    }
  };

  const submitAnswer = () => attempt(Number(value) === question.a * question.b, () => goTo('create'), 'gate.wrong');

  const onDigits = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setValue(digits);
    if (step === 'math' || !isPin(digits)) return;
    if (step === 'pin') {
      attempt(digits === pin, pass, 'gate.pinWrong');
    } else if (step === 'create') {
      setFirstPin(digits);
      goTo('confirm');
    } else if (digits === firstPin) {
      try {
        setParentPin(digits);
        pass();
      } catch {
        goTo('create', 'gate.pinMismatch'); // not saved: choose again rather than pass without a PIN
      }
    } else {
      goTo('create', 'gate.pinMismatch');
    }
  };

  const cancel = () => {
    goTo(null);
    onCancel();
  };

  return (
    <Modal
      visible={visible && !passed}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      onDismiss={finishPass}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(34,48,46,0.6)' }}
      >
        <View
          accessibilityViewIsModal
          style={[
            { backgroundColor: tokens.surfaceCard, borderRadius: radius.xl, padding: 22, rowGap: 14 },
            cardShadow,
          ]}
        >
          <Text className="font-display" style={{ fontSize: 24, color: tokens.textPrimary }}>
            {t('gate.title')}
          </Text>
          <Text className="font-body-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
            {step === 'owner' ? t('gate.ownerHint') : step === 'math' ? t('gate.question', question) : t(PROMPT[step])}
          </Text>
          {step === 'owner' ? (
            <Button label={t('gate.ownerConfirm')} onPress={() => void confirmOwner()} />
          ) : (
            <Input
              key={step === 'math' ? 'math' : 'pin'}
              label={t(step === 'math' ? 'gate.answer' : 'gate.pinLabel')}
              value={value}
              onChangeText={onDigits}
              keyboardType="number-pad"
              maxLength={step === 'math' ? 3 : 4}
              secureTextEntry={step !== 'math'}
              textContentType="none"
              autoComplete="off"
              autoFocus
              onSubmitEditing={step === 'math' ? submitAnswer : undefined}
            />
          )}
          {message ? (
            <Text accessibilityLiveRegion="polite" className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {t(message)}
            </Text>
          ) : null}
          {step === 'math' ? <Button label={t('gate.continue')} onPress={submitAnswer} disabled={value.length === 0} /> : null}
          {step === 'pin' ? <Button label={t('gate.forgot')} variant="ghost" onPress={() => goTo('owner')} /> : null}
          <Button label={t('gate.back')} variant="ghost" onPress={cancel} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * `requireParent(action)` runs `action` after the grown-ups check passes.
 * Render `gate` once in the screen.
 */
export function useParentalGate() {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const gate = (
    <ParentalGate
      visible={pending !== null}
      onPass={() => {
        const action = pending;
        setPending(null);
        action?.();
      }}
      onCancel={() => setPending(null)}
    />
  );
  return { gate, requireParent: (action: () => void) => setPending(() => action) };
}
