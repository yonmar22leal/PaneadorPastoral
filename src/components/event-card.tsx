import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChurchEvent } from '@/types/church';
import {
  EVENT_TYPE_META,
  formatEventDate,
  fromISODate,
  normalizeEventType,
  relativeDayLabel,
  scheduleEndTime,
  weekdayShort,
} from '@/lib/events';

interface Props {
  event: ChurchEvent;
  onPress?: () => void;
  compact?: boolean;
  dark?: boolean;
}

export function EventCard({ event, onPress, compact, dark }: Props) {
  const normType = normalizeEventType(event.type);
  const meta = EVENT_TYPE_META[normType] ?? EVENT_TYPE_META.evento;
  const day = fromISODate(event.date).getDate();
  const rel = relativeDayLabel(event.date);
  const end = scheduleEndTime(event);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        compact && styles.cardCompact,
        dark && styles.cardDark,
        { borderLeftColor: meta.color },
      ]}>
      <View style={[styles.dateBox, { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : meta.soft }]}>
        <Text style={[styles.dateWeekday, { color: dark ? '#BFDBFE' : meta.color }]}>
          {weekdayShort(event.date)}
        </Text>
        <Text style={[styles.dateDay, dark && { color: '#FFFFFF' }]}>{day}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View style={[styles.typePill, { backgroundColor: dark ? 'rgba(255,255,255,0.16)' : meta.soft }]}>
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={11}
              color={dark ? '#FFFFFF' : meta.color}
            />
            <Text style={[styles.typePillText, { color: dark ? '#FFFFFF' : meta.color }]}>
              {meta.label}
            </Text>
          </View>
          {rel && (
            <View style={styles.relPill}>
              <Text style={styles.relPillText}>{rel}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, dark && { color: '#FFFFFF' }]} numberOfLines={compact ? 1 : 2}>
          {event.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={dark ? '#93C5FD' : '#64748B'} />
          <Text style={[styles.metaText, dark && { color: '#DBEAFE' }]}>
            {event.time}
            {end ? ` – ${end}` : ''}
          </Text>
          <Text style={[styles.metaDot, dark && { color: '#93C5FD' }]}>•</Text>
          <Ionicons name="list-outline" size={12} color={dark ? '#93C5FD' : '#64748B'} />
          <Text style={[styles.metaText, dark && { color: '#DBEAFE' }]}>
            {event.schedule.length} bloques
          </Text>
        </View>
        {!compact && (
          <Text style={[styles.dateLong, dark && { color: '#93C5FD' }]}>
            {formatEventDate(event.date)}
            {event.location ? ` · ${event.location}` : ''}
          </Text>
        )}
        {event.createdByName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="person-circle-outline" size={12} color={dark ? '#93C5FD' : '#64748B'} />
            <Text style={{ fontSize: 11, color: dark ? '#BFDBFE' : '#64748B', fontWeight: '500' }}>
              Creado por: <Text style={{ fontWeight: '700' }}>{event.createdByName}</Text>
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={dark ? '#93C5FD' : '#CBD5E1'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCompact: {
    padding: 12,
  },
  cardDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  dateBox: {
    width: 50,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateWeekday: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: -2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  relPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  relPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  metaDot: {
    color: '#CBD5E1',
    marginHorizontal: 2,
  },
  dateLong: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
});
