import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const ITEM_HEIGHT = 42;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 210px

export interface DatePickerFieldProps {
  value?: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  allowClear?: boolean;
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseDate(dateStr?: string): { day: number; month: number; year: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\//g, '-').split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-11
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return { day: d, month: m, year: y };
    }
  }
  return null;
}

export function formatDisplayDate(dateStr?: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return '';
  const { day, month, year } = parsed;
  return `${day} ${MONTH_SHORT[month]} ${year}`;
}

export function formatFullDisplayDate(dateStr?: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return '';
  const { day, month, year } = parsed;
  return `${day} de ${MONTH_NAMES[month]}, ${year}`;
}

export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = 'Seleccionar fecha (Día Mes Año)',
  minYear = 1930,
  maxYear = new Date().getFullYear(),
  allowClear = true,
}: DatePickerFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Fecha seleccionada actual
  const parsedInitial = useMemo(() => parseDate(value), [value]);

  // Estados temporales del picker mientras el modal está abierto
  const now = new Date();
  const [tempYear, setTempYear] = useState<number>(parsedInitial?.year || now.getFullYear() - 20);
  const [tempMonth, setTempMonth] = useState<number>(parsedInitial?.month ?? now.getMonth());
  const [tempDay, setTempDay] = useState<number>(parsedInitial?.day || 1);

  // Referencias a los scrollviews para auto-centrar
  const dayScrollRef = useRef<any>(null);
  const monthScrollRef = useRef<any>(null);
  const yearScrollRef = useRef<any>(null);

  // Lista de años descendente (desde maxYear hasta minYear)
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  // Días válidos para el mes y año seleccionados
  const maxDays = useMemo(() => getDaysInMonth(tempYear, tempMonth), [tempYear, tempMonth]);
  const days = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= maxDays; d++) {
      list.push(d);
    }
    return list;
  }, [maxDays]);

  const handleSelectMonth = (mIdx: number) => {
    setTempMonth(mIdx);
    const newMax = getDaysInMonth(tempYear, mIdx);
    if (tempDay > newMax) {
      setTempDay(newMax);
    }
  };

  const handleSelectYear = (y: number) => {
    setTempYear(y);
    const newMax = getDaysInMonth(y, tempMonth);
    if (tempDay > newMax) {
      setTempDay(newMax);
    }
  };

  const handleOpenModal = () => {
    const currentParsed = parseDate(value);
    let y = now.getFullYear() - 20;
    if (y < minYear) y = now.getFullYear();
    let m = now.getMonth();
    let d = Math.min(now.getDate(), getDaysInMonth(y, m));

    if (currentParsed) {
      y = currentParsed.year;
      m = currentParsed.month;
      d = currentParsed.day;
    }

    setTempYear(y);
    setTempMonth(m);
    setTempDay(d);
    setModalVisible(true);

    setTimeout(() => {
      const dayIdx = d - 1;
      if (dayIdx >= 0 && dayScrollRef.current) {
        dayScrollRef.current.scrollTo({ y: dayIdx * ITEM_HEIGHT, animated: false });
      }
      if (monthScrollRef.current) {
        monthScrollRef.current.scrollTo({ y: m * ITEM_HEIGHT, animated: false });
      }
      const yearIdx = years.indexOf(y);
      if (yearIdx >= 0 && yearScrollRef.current) {
        yearScrollRef.current.scrollTo({ y: yearIdx * ITEM_HEIGHT, animated: false });
      }
    }, 60);
  };

  const handleConfirm = () => {
    const safeDay = Math.min(tempDay, maxDays);
    const mm = String(tempMonth + 1).padStart(2, '0');
    const dd = String(safeDay).padStart(2, '0');
    const result = `${tempYear}-${mm}-${dd}`;
    onChange(result);
    setModalVisible(false);
  };

  const handleClear = () => {
    onChange('');
    setModalVisible(false);
  };

  const hasValue = Boolean(value && parseDate(value));

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* BOTÓN / BARRA PRINCIPAL QUE ABRE EL PICKER EN TODA LA SUPERFICIE */}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={handleOpenModal}
        activeOpacity={0.8}>
        <View style={styles.calendarIconBox}>
          <Ionicons name="calendar" size={18} color="#38BDF8" />
        </View>

        <View style={styles.triggerContent}>
          {hasValue ? (
            <>
              <Text style={styles.triggerValueText}>
                {formatFullDisplayDate(value)}
              </Text>
              <Text style={styles.triggerSubText}>
                {formatDisplayDate(value)} • Toca para cambiar
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.triggerPlaceholderText}>{placeholder}</Text>
              <Text style={styles.triggerSubText}>
                Toca aquí para abrir el selector de fecha
              </Text>
            </>
          )}
        </View>

        <View style={styles.chevronBox}>
          <Ionicons name="chevron-down" size={18} color="#38BDF8" />
        </View>
      </TouchableOpacity>

      {/* MODAL CON EL SELECTOR ESTILO RUEDA / WHEEL (DÍA - MES - AÑO) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* CABECERA CON BOTÓN CLEAR / LIMPIAR Y CONFIRMAR */}
            <View style={styles.modalHeader}>
              {allowClear ? (
                <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Borrar</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 60 }} />
              )}

              <View style={{ alignItems: 'center' }}>
                <Text style={styles.modalTitle}>Seleccionar Fecha</Text>
                <Text style={styles.modalPreviewText}>
                  {tempDay} de {MONTH_NAMES[tempMonth]} de {tempYear}
                </Text>
              </View>

              <TouchableOpacity onPress={handleConfirm} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Listo</Text>
              </TouchableOpacity>
            </View>

            {/* CONTENEDOR DE LAS 3 RUEDAS / COLUMNAS */}
            <View style={styles.pickerContainer}>
              {/* LÍNEA / FRANJA CENTRAL DE SELECCIÓN DESTACADA */}
              <View pointerEvents="none" style={styles.centerHighlightBar} />

              {/* COLUMNA 1: DÍA */}
              <View style={[styles.wheelColumn, { flex: 1.1 }]}>
                <Text style={styles.columnHeader}>Día</Text>
                <ScrollView
                  ref={dayScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelScrollContent}>
                  {days.map((d) => {
                    const isSelected = d === tempDay;
                    return (
                      <TouchableOpacity
                        key={`day-${d}`}
                        style={styles.wheelItem}
                        onPress={() => setTempDay(d)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.wheelItemText,
                            isSelected && styles.wheelItemTextSelected,
                          ]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* COLUMNA 2: MES */}
              <View style={[styles.wheelColumn, { flex: 2 }]}>
                <Text style={styles.columnHeader}>Mes</Text>
                <ScrollView
                  ref={monthScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelScrollContent}>
                  {MONTH_NAMES.map((mName, mIdx) => {
                    const isSelected = mIdx === tempMonth;
                    return (
                      <TouchableOpacity
                        key={`month-${mName}`}
                        style={styles.wheelItem}
                        onPress={() => handleSelectMonth(mIdx)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.wheelItemText,
                            isSelected && styles.wheelItemTextSelected,
                          ]}
                          numberOfLines={1}>
                          {mName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* COLUMNA 3: AÑO */}
              <View style={[styles.wheelColumn, { flex: 1.4 }]}>
                <Text style={styles.columnHeader}>Año</Text>
                <ScrollView
                  ref={yearScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelScrollContent}>
                  {years.map((y) => {
                    const isSelected = y === tempYear;
                    return (
                      <TouchableOpacity
                        key={`year-${y}`}
                        style={styles.wheelItem}
                        onPress={() => handleSelectYear(y)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.wheelItemText,
                            isSelected && styles.wheelItemTextSelected,
                          ]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* BOTÓN INFERIOR DE ACCIÓN RÁPIDA */}
            <View style={styles.modalBottomBar}>
              <TouchableOpacity
                style={styles.confirmBottomBtn}
                onPress={handleConfirm}
                activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.confirmBottomBtnText}>
                  Confirmar Fecha ({tempDay} {MONTH_SHORT[tempMonth]} {tempYear})
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 10,
    marginBottom: 6,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none' as any } : {}),
  },
  calendarIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  triggerValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  triggerPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  triggerSubText: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '500',
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // MODAL STYLES (iOS Style Wheel Picker)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalPreviewText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // WHEELS CONTAINER
  pickerContainer: {
    flexDirection: 'row',
    height: CONTAINER_HEIGHT,
    position: 'relative',
    backgroundColor: '#090D16',
  },
  centerHighlightBar: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2, // Posición centrada (ítem número 3 de 5)
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 10,
    zIndex: 1,
  },
  wheelColumn: {
    height: CONTAINER_HEIGHT,
    position: 'relative',
    zIndex: 2,
  },
  columnHeader: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  wheelScrollContent: {
    paddingVertical: ITEM_HEIGHT * 2, // Espacio superior e inferior para centrar
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  wheelItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  wheelItemTextSelected: {
    fontSize: 17,
    fontWeight: '800',
    color: '#38BDF8',
    transform: [{ scale: 1.05 }],
  },

  // BOTTOM ACTION
  modalBottomBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  confirmBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBottomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
