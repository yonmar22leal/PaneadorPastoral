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

export function EventCard({ event, onPress, compact }: Props) {
  const normType = normalizeEventType(event.type);
  const meta = EVENT_TYPE_META[normType] ?? EVENT_TYPE_META.evento;
  const day = fromISODate(event.date).getDate();
  const rel = relativeDayLabel(event.date);
  const end = scheduleEndTime(event);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.card,
        compact && styles.cardCompact,
        { borderLeftColor: meta.color || '#38BDF8' },
      ]}>
      <View style={[styles.dateBox, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
        <Text style={[styles.dateWeekday, { color: meta.color || '#38BDF8' }]}>
          {weekdayShort(event.date)}
        </Text>
        <Text style={styles.dateDay}>{day}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View
            style={[
              styles.typePill,
              {
                backgroundColor: meta.color ? `${meta.color}22` : 'rgba(56, 189, 248, 0.15)',
                borderColor: meta.color ? `${meta.color}44` : 'rgba(56, 189, 248, 0.3)',
              },
            ]}>
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={11}
              color={meta.color || '#38BDF8'}
            />
            <Text style={[styles.typePillText, { color: meta.color || '#38BDF8' }]}>
              {meta.label}
            </Text>
          </View>
          {rel && (
            <View style={styles.relPill}>
              <Text style={styles.relPillText}>{rel}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={compact ? 1 : 2}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color="#38BDF8" />
          <Text style={styles.metaText}>
            {event.time}
            {end ? ` – ${end}` : ''}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Ionicons name="list-outline" size={12} color="#38BDF8" />
          <Text style={styles.metaText}>
            {event.schedule.length} bloques
          </Text>
        </View>

        {!compact && (
          <Text style={styles.dateLong}>
            {formatEventDate(event.date)}
            {event.location ? ` · ${event.location}` : ''}
          </Text>
        )}

        {event.createdByName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="person-circle-outline" size={12} color="#64748B" />
            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>
              Creado por: <Text style={{ fontWeight: '700', color: '#CBD5E1' }}>{event.createdByName}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#64748B" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompact: {
    padding: 12,
  },
  dateBox: {
    width: 50,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dateWeekday: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  relPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  relPillText: {
    color: '#FB7185',
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metaDot: {
    color: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 2,
  },
  dateLong: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
});
