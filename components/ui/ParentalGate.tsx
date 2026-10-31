import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { hardShadow, outline, radius, tokens } from '@/lib/tokens';

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

  const reset = () => {
    setQuestion(newQuestion());
    setAnswer('');
  };

  const submit = () => {
    if (Number(answer) === question.a * question.b) {
      setWrong(false);
      reset();
      onPass();
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(20,20,43,0.6)' }}
      >
        <View
          accessibilityViewIsModal
          style={[
            { backgroundColor: tokens.surfaceCard, borderRadius: radius['2xl'], padding: 22, rowGap: 14 },
            outline,
            hardShadow(6),
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
