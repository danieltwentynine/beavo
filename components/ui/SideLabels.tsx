import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { radius, tokens } from '@/lib/tokens';

export function SideLabels({ left, right, width, session = false }: {
  left: string;
  right: string;
  width: number;
  session?: boolean;
}) {
  const color = session ? tokens.textPrimary : tokens.textSecondary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, flexDirection: 'row', justifyContent: 'space-between', columnGap: 4, marginTop: 8 }}
    >
      {([left, right] as const).map((label, index) => {
        const content = (
          <>
            {index === 0 ? <CaretLeft size={16} color={color} weight="bold" /> : null}
            <Text className="font-body-semi" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
              style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, color }}>
              {label}
            </Text>
            {index === 1 ? <CaretRight size={16} color={color} weight="bold" /> : null}
          </>
        );
        const row = { flexDirection: 'row', alignItems: 'center', columnGap: 4, flexShrink: 1 } as const;
        return session ? (
          <GlassSurface key={index} ground="session" tint={tokens.sessionPill}
            style={[row, { minHeight: 32, paddingVertical: 4, paddingHorizontal: 12, borderRadius: radius.pill }]}>
            {content}
          </GlassSurface>
        ) : <View key={index} style={row}>{content}</View>;
      })}
    </View>
  );
}
