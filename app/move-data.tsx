import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { BeavoWave } from '@/components/brand/BeavoBrand';
import { Button } from '@/components/ui/Button';
import { useParentalGate } from '@/components/ui/ParentalGate';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { useLocalChildNames } from '@/hooks/useLocalChildNames';
import { t } from '@/lib/i18n';
import { eraseLocalData, moveLocalDataToAccount } from '@/lib/localData';
import { useAuthStore } from '@/stores/authStore';

/**
 * Shown once per launch to a signed-in parent while this phone still holds
 * profiles from device-only mode (ADR 0005). The move is never automatic: the
 * person who signed in may not be the parent whose children are on the phone,
 * so they are named, and moving them sits behind the parental gate.
 */
export default function MoveDataScreen() {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const declineMove = useAuthStore((s) => s.declineMove);
  const names = useLocalChildNames();
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const { gate, requireParent } = useParentalGate();

  if (!uid || (names !== null && names.length === 0 && !moving)) return <Redirect href="/" />;
  if (names === null) return <SafeScreen>{null}</SafeScreen>;

  const move = async () => {
    setFailed(false);
    setMoving(true);
    const ok = await moveLocalDataToAccount(uid);
    setMoving(false);
    if (ok) router.replace('/');
    else setFailed(true);
  };

  // Signed in, More only covers the account, so the right to erase what is on
  // the phone has to be reachable here.
  const erase = () =>
    Alert.alert(t('more.eraseTitle'), t('more.eraseBody'), [
      { text: t('more.eraseKeep'), style: 'cancel' },
      {
        text: t('more.eraseConfirm'),
        style: 'destructive',
        onPress: async () => {
          setMoving(true);
          const ok = await eraseLocalData();
          setMoving(false);
          if (ok) router.replace('/');
          else Alert.alert(t('more.eraseFail'));
        },
      },
    ]);

  const keep = () => {
    declineMove();
    router.replace('/');
  };

  return (
    <SafeScreen>
      <ScrollView contentContainerClassName="flex-grow px-6 pb-7 pt-4">
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <BeavoWave width={140} />
        </View>
        <Text className="font-display text-3xl text-ink">{t('move.title')}</Text>
        <Text className="mt-3 font-body text-base text-muted">{t('move.body', { names: names.join(', ') })}</Text>
        <Text className="mt-3 font-body text-base text-muted">{t('move.keepHint')}</Text>
        {failed ? <Text className="mt-4 font-body-semi text-base text-ink">{t('move.fail')}</Text> : null}

        <View style={{ marginTop: 'auto', paddingTop: 28, rowGap: 12 }}>
          <Button label={t('move.confirm')} size="lg" loading={moving} onPress={() => requireParent(() => void move())} />
          <Button label={t('move.keep')} variant="ghost" disabled={moving} onPress={keep} />
          <Button label={t('more.erase')} variant="ghost" size="sm" disabled={moving} onPress={() => requireParent(erase)} />
        </View>
      </ScrollView>
      {gate}
    </SafeScreen>
  );
}
