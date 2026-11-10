import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { cardShadow, radius, tokens } from '@/lib/tokens';

const factor = () => 6 + Math.floor(Math.random() * 4); // 6–9: beyond a young child's times tables
const newQuestion = () => ({ a: factor(), b: factor() });

interface ParentalGateProps {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
}

/**
 * Grown-ups-only check before adding/deleting a profile or the account: a
 * written multiplication question. Young children can't read or solve it;
 * a wrong answer just swaps in a new question (no lockout, no red).
 */
export function ParentalGate({ visible, onPass, onCancel }: ParentalGateProps) {
  const [question, setQuestion] = useState(newQuestion);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
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

  const reset = () => {
    setQuestion(newQuestion());
    setAnswer('');
  };

  const submit = () => {
    if (Number(answer) === question.a * question.b) {
      setWrong(false);
      reset();
      if (Platform.OS === 'ios') {
        setPassed(true);
        passTimer.current = setTimeout(finishPass, 600); // longer than the fade-out
      } else {
        onPass();
      }
    } else {
      setWrong(true);
      reset();
    }
  };

  const cancel = () => {
    setWrong(false);
    reset();
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
            {t('gate.question', question)}
          </Text>
          <Input
            label={t('gate.answer')}
            value={answer}
            onChangeText={(v) => setAnswer(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            autoFocus
            onSubmitEditing={submit}
          />
          {wrong ? (
            <Text className="font-body-semi" style={{ fontSize: 14, color: tokens.textSecondary }}>
              {t('gate.wrong')}
            </Text>
          ) : null}
          <Button label={t('gate.continue')} onPress={submit} disabled={answer.length === 0} />
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
