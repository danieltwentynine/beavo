import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t, type StringKey } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';
import { isPin, useSettingsStore } from '@/stores/settingsStore';

const factor = () => 6 + Math.floor(Math.random() * 4); // 6–9: beyond a young child's times tables
const newQuestion = () => ({ a: factor(), b: factor() });

interface ParentalGateProps {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
}

type Step = 'pin' | 'math' | 'create' | 'confirm';
const PROMPT = { pin: 'gate.pinPrompt', create: 'gate.pinCreate', confirm: 'gate.pinConfirm' } as const;

/**
 * Grown-ups-only check: the parent's 4-digit PIN (kept on this phone). The PIN
 * is chosen the first time, after one written multiplication question that
 * young children can't read or solve; the same question resets a forgotten
 * PIN. A wrong answer or PIN just asks again (no lockout, no red).
 */
export function ParentalGate({ visible, onPass, onCancel }: ParentalGateProps) {
  const pin = useSettingsStore((s) => s.parentPin);
  const setParentPin = useSettingsStore((s) => s.setParentPin);
  // null: start from the PIN when there is one, else from the question.
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const step: Step = chosenStep ?? (pin ? 'pin' : 'math');
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

  const submitAnswer = () => {
    if (Number(value) === question.a * question.b) goTo('create');
    else goTo('math', 'gate.wrong');
  };

  const onDigits = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setValue(digits);
    if (step === 'math' || !isPin(digits)) return;
    if (step === 'pin') {
      if (digits === pin) pass();
      else goTo('pin', 'gate.pinWrong');
    } else if (step === 'create') {
      setFirstPin(digits);
      goTo('confirm');
    } else if (digits === firstPin) {
      setParentPin(digits);
      pass();
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
          {step === 'math' && !pin ? (
            <Text className="font-body" style={{ fontSize: 16, color: tokens.textSecondary }}>
              {t('gate.setupHint')}
            </Text>
          ) : null}
          <Text className="font-body-semi" style={{ fontSize: 18, color: tokens.textPrimary }}>
            {step === 'math' ? t('gate.question', question) : t(PROMPT[step])}
          </Text>
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
          {message ? (
            <Text accessibilityLiveRegion="polite" className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {t(message)}
            </Text>
          ) : null}
          {step === 'math' ? <Button label={t('gate.continue')} onPress={submitAnswer} disabled={value.length === 0} /> : null}
          {step === 'pin' ? <Button label={t('gate.forgot')} variant="ghost" onPress={() => goTo('math')} /> : null}
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
