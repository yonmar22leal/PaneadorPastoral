import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220px
const PADDING_VERTICAL = ITEM_HEIGHT * 2; // 88px (para que el primer y último ítem puedan quedar al centro)

export interface DatePickerFieldProps {
  value?: string; // Formato: YYYY-MM-DD
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

// =============================================================================
// SUB-COMPONENTE: RUEDA INDIVIDUAL (ARRASTRABLE CON RATÓN O DEDO)
// =============================================================================
interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (item: T) => void;
  renderLabel?: (item: T) => string;
  flex?: number;
}

function WheelColumn<T>({
  items,
  selectedIndex,
  onSelect,
  renderLabel,
  flex = 1,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollYRef = useRef(0);
  const hasMovedRef = useRef(false);
  const isInternalScrollRef = useRef(false);

  const currentOffsetYRef = useRef(selectedIndex * ITEM_HEIGHT);

  const scrollToIndex = React.useCallback((index: number, animated = true) => {
    if (index < 0 || index >= items.length) return;
    const targetY = index * ITEM_HEIGHT;
    currentOffsetYRef.current = targetY;
    scrollRef.current?.scrollTo?.({ y: targetY, animated });
  }, [items.length]);

  // Posicionar el scroll exactamente en el ítem seleccionado al montarse o al cambiar el índice
  useEffect(() => {
    if (!isDraggingRef.current && !isInternalScrollRef.current) {
      const timer = setTimeout(() => {
        scrollToIndex(selectedIndex, false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex, scrollToIndex]);

  // Actualizar cuando termina de desplazarse en dispositivos táctiles o rueda
  const handleScrollEnd = (offsetY: number) => {
    currentOffsetYRef.current = offsetY;
    const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(items.length - 1, rawIdx));
    if (clampedIdx !== selectedIndex) {
      isInternalScrollRef.current = true;
      onSelect(items[clampedIdx]);
      setTimeout(() => {
        isInternalScrollRef.current = false;
      }, 80);
    }
  };

  // ===========================================================================
  // SOPORTE DE ARRASTRE CON RATÓN (PC WEB) - APRETANDO Y SUBIENDO/BAJANDO
  // ===========================================================================
  const onMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY || e.pageY || 0;
    startScrollYRef.current = currentOffsetYRef.current;
  };

  const onMouseMove = (e: any) => {
    if (Platform.OS !== 'web' || !isDraggingRef.current) return;
    const clientY = e.clientY || e.pageY || 0;
    const deltaY = clientY - startYRef.current;
    if (Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }
    const targetY = Math.max(0, startScrollYRef.current - deltaY);
    currentOffsetYRef.current = targetY;
    scrollRef.current?.scrollTo?.({ y: targetY, animated: false });
  };

  const onMouseUp = () => {
    if (Platform.OS !== 'web' || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    const finalScroll = currentOffsetYRef.current;
    const nearestIdx = Math.max(0, Math.min(items.length - 1, Math.round(finalScroll / ITEM_HEIGHT)));
    scrollToIndex(nearestIdx, true);
    if (nearestIdx !== selectedIndex) {
      isInternalScrollRef.current = true;
      onSelect(items[nearestIdx]);
      setTimeout(() => {
        isInternalScrollRef.current = false;
      }, 80);
    }
  };

  const webProps: any =
    Platform.OS === 'web'
      ? {
          onMouseDown,
          onMouseMove,
          onMouseUp,
          onMouseLeave: onMouseUp,
        }
      : {};

  const columnStyle = [
    styles.wheelColumnWrapper,
    { flex },
    Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none' } as any) : null,
  ];

  return (
    <View style={columnStyle} {...webProps}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => handleScrollEnd(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => handleScrollEnd(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={styles.wheelScrollContent}>
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const label = renderLabel ? renderLabel(item) : String(item);
          return (
            <TouchableOpacity
              key={`wheel-it-${idx}-${label}`}
              style={styles.wheelItem}
              activeOpacity={0.7}
              onPress={() => {
                if (!hasMovedRef.current) {
                  scrollToIndex(idx, true);
                  onSelect(item);
                }
              }}>
              <Text
                style={[
                  styles.wheelItemText,
                  isSelected && styles.wheelItemTextSelected,
                ]}
                numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
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

  const parsedInitial = useMemo(() => parseDate(value), [value]);

  const now = new Date();
  const [tempYear, setTempYear] = useState<number>(parsedInitial?.year || now.getFullYear() - 20);
  const [tempMonth, setTempMonth] = useState<number>(parsedInitial?.month ?? now.getMonth());
  const [tempDay, setTempDay] = useState<number>(parsedInitial?.day || 1);

  // Lista de años descendente (ej: 2026, 2025 ... 1930)
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

  const handleSelectMonth = (mName: string) => {
    const mIdx = MONTH_NAMES.indexOf(mName);
    if (mIdx >= 0) {
      setTempMonth(mIdx);
      const newMax = getDaysInMonth(tempYear, mIdx);
      if (tempDay > newMax) {
        setTempDay(newMax);
      }
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

  // Índices seleccionados
  const selectedDayIndex = Math.max(0, Math.min(days.length - 1, tempDay - 1));
  const selectedYearIndex = Math.max(0, Math.min(years.length - 1, years.indexOf(tempYear)));

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* BOTÓN / BARRA PRINCIPAL */}
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

      {/* MODAL CON EL SELECTOR ESTILO RUEDA (DÍA - MES - AÑO) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* CABECERA CON BOTONES BORRAR Y LISTO */}
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

            {/* TITULOS DE COLUMNAS (FUERA DE LA RUEDA PARA QUE LA ALINEACIÓN SEA 100% RECTA) */}
            <View style={styles.columnsHeaderRow}>
              <Text style={[styles.columnHeaderText, { flex: 1.1 }]}>DÍA</Text>
              <Text style={[styles.columnHeaderText, { flex: 2 }]}>MES</Text>
              <Text style={[styles.columnHeaderText, { flex: 1.4 }]}>AÑO</Text>
            </View>

            {/* CONTENEDOR DE LAS 3 RUEDAS CON FRANJA CENTRAL ALINEADA AL MILÍMETRO */}
            <View style={styles.pickerContainer}>
              {/* FRANJA CENTRAL DE SELECCIÓN DESTACADA */}
              <View pointerEvents="none" style={styles.centerHighlightBar} />

              {/* COLUMNA 1: DÍA */}
              <WheelColumn
                items={days}
                selectedIndex={selectedDayIndex}
                onSelect={(d) => setTempDay(d)}
                flex={1.1}
              />

              {/* COLUMNA 2: MES */}
              <WheelColumn
                items={MONTH_NAMES}
                selectedIndex={tempMonth}
                onSelect={handleSelectMonth}
                flex={2}
              />

              {/* COLUMNA 3: AÑO */}
              <WheelColumn
                items={years}
                selectedIndex={selectedYearIndex}
                onSelect={handleSelectYear}
                flex={1.4}
              />
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

  // ENCABEZADOS DE COLUMNA SEPARADOS
  columnsHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
  },
  columnHeaderText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // WHEELS CONTAINER (GEOMETRÍA EXACTA)
  pickerContainer: {
    flexDirection: 'row',
    height: CONTAINER_HEIGHT,
    position: 'relative',
    backgroundColor: '#090D16',
    overflow: 'hidden',
  },
  centerHighlightBar: {
    position: 'absolute',
    top: PADDING_VERTICAL, // Exactamente 88px (ítem central número 3 de 5)
    left: 8,
    right: 8,
    height: ITEM_HEIGHT, // Exactamente 44px
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 10,
    zIndex: 1,
  },
  wheelColumnWrapper: {
    height: CONTAINER_HEIGHT,
    position: 'relative',
    zIndex: 2,
  },
  wheelScrollContent: {
    paddingTop: PADDING_VERTICAL, // Exactamente 88px
    paddingBottom: PADDING_VERTICAL, // Exactamente 88px
  },
  wheelItem: {
    height: ITEM_HEIGHT, // Exactamente 44px
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  wheelItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  wheelItemTextSelected: {
    fontSize: 18,
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
