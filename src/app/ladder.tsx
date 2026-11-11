import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import { LadderPerson, LadderStage } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STAGES: { id: LadderStage; label: string; verb: string; color: string; icon: string }[] = [
  { id: 'ganar', label: 'Ganar', verb: 'Ganando', color: '#38BDF8', icon: 'person-add' },
  { id: 'consolidar', label: 'Consolidar', verb: 'Consolidando', color: '#2DD4BF', icon: 'shield-checkmark' },
  { id: 'discipular', label: 'Discipular', verb: 'Discipulando', color: '#A78BFA', icon: 'school' },
  { id: 'enviar', label: 'Enviar', verb: 'Enviados', color: '#FBBF24', icon: 'paper-plane' },
];

const MONTHS_Q = ['Ene – Mar', 'Abr – Jun', 'Jul – Sep', 'Oct – Dic'];

type QuarterRef = { year: number; q: number };

function currentQuarter(): QuarterRef {
  const d = new Date();
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) };
}

function inQuarter(iso: string | undefined, ref: QuarterRef): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.year && Math.floor(d.getMonth() / 3) === ref.q;
}

type Counts = {
  entered: Record<LadderStage, number>;
  lost: number;
  paused: number;
  active: Record<LadderStage, number>;
};

function computeCounts(people: LadderPerson[], ref: QuarterRef): Counts {
  const entered: Record<LadderStage, number> = { ganar: 0, consolidar: 0, discipular: 0, enviar: 0 };
  const active: Record<LadderStage, number> = { ganar: 0, consolidar: 0, discipular: 0, enviar: 0 };
  let lost = 0;
  let paused = 0;
  people.forEach((p) => {
    p.history.forEach((h) => {
      if (inQuarter(h.date, ref)) entered[h.stage] += 1;
    });
    if (p.status === 'lost' && inQuarter(p.statusChangedAt, ref)) lost += 1;
    if (p.status === 'paused' && inQuarter(p.statusChangedAt, ref)) paused += 1;
    if (p.status === 'active') active[p.stage] += 1;
  });
  return { entered, lost, paused, active };
}

function confirmAction(title: string, message: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onOk();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onOk },
    ]);
  }
}

export default function LadderScreen() {
  const router = useRouter();
  const {
    currentUser,
    ladderPeople,
    addLadderPerson,
    moveLadderPerson,
    setLadderPersonStatus,
    deleteLadderPerson,
  } = useChurch();

  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const [tab, setTab] = useState<'escalera' | 'archivo' | 'reporte'>('escalera');
  const [stage, setStage] = useState<LadderStage>('ganar');
  const [quarter, setQuarter] = useState<QuarterRef>(currentQuarter());
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [expandedLeaderId, setExpandedLeaderId] = useState<string | null>(null);

  const effectiveScope = isPastor ? scope : 'mine';

  const [modalVisible, setModalVisible] = useState(false);
  const [newPersonStage, setNewPersonStage] = useState<LadderStage>('ganar');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const openAddModal = (targetStage?: LadderStage) => {
    setNewPersonStage(targetStage || stage);
    setName('');
    setAge('');
    setPhone('');
    setNotes('');
    setModalVisible(true);
  };

  const myPeople = useMemo(
    () => ladderPeople.filter((p) => p.leaderId === currentUser?.id),
    [ladderPeople, currentUser]
  );

  const scopedPeople = effectiveScope === 'all' ? ladderPeople : myPeople;

  const stageList = useMemo(
    () => scopedPeople.filter((p) => p.stage === stage && p.status === 'active'),
    [scopedPeople, stage]
  );
  const archiveList = useMemo(
    () => scopedPeople.filter((p) => p.status !== 'active'),
    [scopedPeople]
  );

  const counts = useMemo(() => computeCounts(scopedPeople, quarter), [scopedPeople, quarter]);

  const perLeader = useMemo(() => {
    if (effectiveScope !== 'all') return [];
    const map = new Map<string, { name: string; people: LadderPerson[] }>();
    ladderPeople.forEach((p) => {
      const e = map.get(p.leaderId) || { name: p.leaderName, people: [] };
      e.people.push(p);
      map.set(p.leaderId, e);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      people: v.people,
      counts: computeCounts(v.people, quarter),
    }));
  }, [ladderPeople, quarter, effectiveScope]);

  const shiftQuarter = (delta: number) => {
    setQuarter((prev) => {
      let idx = prev.year * 4 + prev.q + delta;
      return { year: Math.floor(idx / 4), q: ((idx % 4) + 4) % 4 };
    });
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    const parsedAge = parseInt(age.trim(), 10);
    await addLadderPerson({
      name,
      age: Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : undefined,
      phone,
      notes,
      stage: newPersonStage,
    });
    setName('');
    setAge('');
    setPhone('');
    setNotes('');
    setModalVisible(false);
    setStage(newPersonStage);
    setTab('escalera');
  };

  const nextStage = (s: LadderStage): LadderStage | null => {
    const i = STAGES.findIndex((x) => x.id === s);
    return i < STAGES.length - 1 ? STAGES[i + 1].id : null;
  };

  const renderPerson = (p: LadderPerson, archived: boolean) => {
    const st = STAGES.find((s) => s.id === p.stage)!;
    const next = nextStage(p.stage);
    return (
      <View key={p.id} style={styles.personCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.personIcon, { backgroundColor: st.color + '30' }]}>
            <Ionicons name={st.icon as any} size={18} color={st.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{p.name}</Text>
            {effectiveScope === 'all' && (
              <Text style={{ fontSize: 11, color: '#38BDF8', fontWeight: '600', marginTop: 1 }}>
                Líder: {p.leaderName}
              </Text>
            )}
            <Text style={styles.personMeta}>
              {archived
                ? `${p.status === 'lost' ? 'Se fue' : 'En pausa'} · llegó hasta ${st.label}`
                : `Desde ${new Date(p.createdAt).toLocaleDateString()}`}
              {p.age ? ` · ${p.age} años` : ''}
              {p.phone ? ` · ${p.phone}` : ''}
            </Text>
            {p.notes ? <Text style={styles.personNotes}>{p.notes}</Text> : null}
          </View>
          {p.phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${p.phone}`)} style={styles.iconBtn}>
              <Ionicons name="call" size={16} color="#38BDF8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {archived ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(16,185,129,0.2)' }]}
                onPress={() => setLadderPersonStatus(p.id, 'active')}>
                <Ionicons name="refresh" size={14} color="#34D399" />
                <Text style={[styles.actionText, { color: '#34D399' }]}>Retomar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.15)' }]}
                onPress={() =>
                  confirmAction('Eliminar', `¿Eliminar definitivamente a ${p.name}? Dejará de contar en los reportes.`, () =>
                    deleteLadderPerson(p.id)
                  )
                }>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Eliminar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {next && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: st.color + '30' }]}
                  onPress={() => moveLadderPerson(p.id, next)}>
                  <Ionicons name="arrow-up-circle" size={14} color={st.color} />
                  <Text style={[styles.actionText, { color: st.color }]}>
                    Pasar a {STAGES.find((s) => s.id === next)!.label}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: 'rgba(245,158,11,0.18)' }]}
                onPress={() => setLadderPersonStatus(p.id, 'paused')}>
                <Ionicons name="pause" size={14} color="#F59E0B" />
                <Text style={[styles.actionText, { color: '#F59E0B' }]}>Pausar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderCountsGrid = (c: Counts) => (
    <View style={styles.reportGrid}>
      {STAGES.map((s) => (
        <View key={s.id} style={[styles.reportCell, { borderColor: s.color + '55' }]}>
          <Ionicons name={s.icon as any} size={18} color={s.color} />
          <Text style={styles.reportValue}>{c.entered[s.id]}</Text>
          <Text style={styles.reportLabel}>
            {s.id === 'ganar' ? 'Ganados' : s.id === 'enviar' ? 'Enviados' : `Pasaron a ${s.label}`}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <DoodleBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Escalera del Éxito</Text>
            <Text style={styles.subtitle}>Ganar · Consolidar · Discipular · Enviar</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => openAddModal(stage)}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {isPastor && (
          <View style={[styles.tabsRow, { paddingBottom: 0 }]}>
            <TouchableOpacity
              style={[styles.tabBtn, effectiveScope === 'all' && styles.tabBtnActive]}
              onPress={() => setScope('all')}>
              <Text style={[styles.tabText, effectiveScope === 'all' && styles.tabTextActive]}>
                Todos los líderes ({ladderPeople.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, effectiveScope === 'mine' && styles.tabBtnActive]}
              onPress={() => setScope('mine')}>
              <Text style={[styles.tabText, effectiveScope === 'mine' && styles.tabTextActive]}>
                Mi escalera ({myPeople.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabsRow}>
          {(
            [
              ['escalera', 'Escalera'],
              ['archivo', `Archivo (${archiveList.length})`],
              ['reporte', 'Reporte Trimestral'],
            ] as const
          ).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
              onPress={() => setTab(id)}>
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'escalera' && (
            <>
              <View style={styles.stageRow}>
                {STAGES.map((s) => {
                  const n = scopedPeople.filter((p) => p.stage === s.id && p.status === 'active').length;
                  const sel = stage === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.stageChip,
                        sel && { backgroundColor: s.color + '30', borderColor: s.color },
                      ]}
                      onPress={() => setStage(s.id)}>
                      <Ionicons name={s.icon as any} size={16} color={sel ? s.color : '#94A3B8'} />
                      <Text style={[styles.stageChipText, sel && { color: s.color }]}>{s.label}</Text>
                      <Text style={[styles.stageCount, sel && { color: s.color }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[
                  styles.addStageBannerBtn,
                  {
                    borderColor: STAGES.find((s) => s.id === stage)!.color + '66',
                    backgroundColor: STAGES.find((s) => s.id === stage)!.color + '1F',
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => openAddModal(stage)}>
                <Ionicons
                  name="add-circle"
                  size={20}
                  color={STAGES.find((s) => s.id === stage)!.color}
                />
                <Text
                  style={[
                    styles.addStageBannerText,
                    { color: STAGES.find((s) => s.id === stage)!.color },
                  ]}>
                  Agregar persona en {STAGES.find((s) => s.id === stage)!.label}
                </Text>
              </TouchableOpacity>

              {stageList.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Nadie en {STAGES.find((s) => s.id === stage)!.label}</Text>
                  <Text style={styles.emptyText}>
                    Presiona el botón de arriba o + para anotar las personas que ya tienes en{' '}
                    {STAGES.find((s) => s.id === stage)!.label}.
                  </Text>
                </View>
              ) : (
                stageList.map((p) => renderPerson(p, false))
              )}
            </>
          )}

          {tab === 'archivo' && (
            <>
              <Text style={styles.hint}>
                Aquí quedan las personas en pausa o que se fueron. No se pierden: puedes retomarlas cuando quieras.
              </Text>
              {archiveList.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Archivo vacío</Text>
                </View>
              ) : (
                archiveList.map((p) => renderPerson(p, true))
              )}
            </>
          )}

          {tab === 'reporte' && (
            <>
              <View style={styles.quarterRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => shiftQuarter(-1)}>
                  <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.quarterTitle}>
                    Trimestre {quarter.q + 1} · {quarter.year}
                  </Text>
                  <Text style={styles.quarterSub}>{MONTHS_Q[quarter.q]}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => shiftQuarter(1)}>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {renderCountsGrid(counts)}

              <View style={styles.lossRow}>
                <View style={[styles.lossCell, { borderColor: 'rgba(245,158,11,0.4)' }]}>
                  <Text style={[styles.reportValue, { color: '#F59E0B' }]}>{counts.paused}</Text>
                  <Text style={styles.reportLabel}>En pausa</Text>
                </View>
                <View style={[styles.lossCell, { borderColor: 'rgba(148,163,184,0.4)' }]}>
                  <Text style={[styles.reportValue, { color: '#94A3B8' }]}>{counts.lost}</Text>
                  <Text style={styles.reportLabel}>Se fueron</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Actualmente en proceso</Text>
              <View style={styles.reportGrid}>
                {STAGES.map((s) => (
                  <View key={s.id} style={styles.activeCell}>
                    <Text style={[styles.reportValue, { color: s.color }]}>{counts.active[s.id]}</Text>
                    <Text style={styles.reportLabel}>{s.verb}</Text>
                  </View>
                ))}
              </View>

              {effectiveScope === 'all' && (
                <>
                  <Text style={styles.sectionTitle}>Desglose por líder ({perLeader.length})</Text>
                  {perLeader.length === 0 ? (
                    <Text style={styles.emptyText}>Aún no hay registros de líderes en este trimestre.</Text>
                  ) : (
                    perLeader.map((l) => {
                      const isExpanded = expandedLeaderId === l.id;
                      return (
                        <TouchableOpacity
                          key={l.id}
                          activeOpacity={0.85}
                          onPress={() => setExpandedLeaderId(isExpanded ? null : l.id)}
                          style={styles.leaderCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="person-circle" size={22} color="#38BDF8" />
                              <Text style={styles.personName}>{l.name}</Text>
                            </View>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#94A3B8"
                            />
                          </View>

                          <View style={styles.leaderBadgesRow}>
                            {STAGES.map((s) => (
                              <View
                                key={s.id}
                                style={[styles.leaderMiniPill, { borderColor: s.color + '55', backgroundColor: s.color + '18' }]}>
                                <Text style={[styles.leaderMiniVal, { color: s.color }]}>
                                  {l.counts.entered[s.id]}
                                </Text>
                                <Text style={styles.leaderMiniLbl}>{s.label}</Text>
                              </View>
                            ))}
                            <View style={[styles.leaderMiniPill, { borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                              <Text style={[styles.leaderMiniVal, { color: '#F59E0B' }]}>{l.counts.paused}</Text>
                              <Text style={styles.leaderMiniLbl}>Pausa</Text>
                            </View>
                            <View style={[styles.leaderMiniPill, { borderColor: 'rgba(148,163,184,0.4)', backgroundColor: 'rgba(148,163,184,0.12)' }]}>
                              <Text style={[styles.leaderMiniVal, { color: '#94A3B8' }]}>{l.counts.lost}</Text>
                              <Text style={styles.leaderMiniLbl}>Se fue</Text>
                            </View>
                          </View>

                          {isExpanded && (
                            <View style={styles.leaderExpandedList}>
                              {l.people.map((p) => {
                                const stObj = STAGES.find((s) => s.id === p.stage)!;
                                const statusLabel =
                                  p.status === 'active'
                                    ? stObj.label
                                    : p.status === 'paused'
                                    ? `En pausa (${stObj.label})`
                                    : `Se fue (${stObj.label})`;
                                const statusColor =
                                  p.status === 'active'
                                    ? stObj.color
                                    : p.status === 'paused'
                                    ? '#F59E0B'
                                    : '#94A3B8';
                                return (
                                  <View key={p.id} style={styles.leaderPersonRow}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.leaderPersonName}>
                                        {p.name}
                                        {p.age ? ` · ${p.age} años` : ''}
                                      </Text>
                                      {p.phone ? (
                                        <Text style={styles.personMeta}>{p.phone}</Text>
                                      ) : null}
                                    </View>
                                    <View style={[styles.statusTag, { borderColor: statusColor + '66', backgroundColor: statusColor + '20' }]}>
                                      <Text style={[styles.statusTagText, { color: statusColor }]}>
                                        {statusLabel}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}

              <Text style={styles.hint}>
                El reporte se genera automáticamente cada trimestre. Los pastores pueden ver el de todos los líderes.
              </Text>
            </>
          )}
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Agregar persona en {STAGES.find((s) => s.id === newPersonStage)!.label}
              </Text>
              <Text style={styles.fieldLabel}>Escalón de la escalera</Text>
              <View style={styles.stageRow}>
                {STAGES.map((s) => {
                  const sel = newPersonStage === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.stageChip,
                        sel && { backgroundColor: s.color + '30', borderColor: s.color },
                      ]}
                      onPress={() => setNewPersonStage(s.id)}>
                      <Ionicons name={s.icon as any} size={15} color={sel ? s.color : '#94A3B8'} />
                      <Text style={[styles.stageChipText, sel && { color: s.color }]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Nombre *"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Edad"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                />
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder="Teléfono"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Notas"
                placeholderTextColor="#64748B"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#10B981', flex: 2 }]} onPress={handleAdd}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </DoodleBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabBtnActive: { backgroundColor: 'rgba(16,185,129,0.25)', borderColor: '#34D399' },
  tabText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  stageRow: { flexDirection: 'row', gap: 6 },
  stageChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(30,41,59,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stageChipText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  stageCount: { fontSize: 16, fontWeight: '800', color: '#CBD5E1' },
  addStageBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addStageBannerText: { fontSize: 13, fontWeight: '700' },
  fieldLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  personCard: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  personIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  personMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  personNotes: { fontSize: 12, color: '#CBD5E1', marginTop: 4, fontStyle: 'italic' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  emptyText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  hint: { fontSize: 12, color: '#94A3B8', lineHeight: 17 },
  quarterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quarterTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  quarterSub: { fontSize: 12, color: '#94A3B8' },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportCell: {
    width: '48%',
    alignItems: 'center',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
  },
  activeCell: {
    width: '48%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(30,41,59,0.6)',
  },
  reportValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  reportLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  lossRow: { flexDirection: 'row', gap: 10 },
  lossCell: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  leaderCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  leaderBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  leaderMiniPill: {
    flex: 1,
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  leaderMiniVal: { fontSize: 14, fontWeight: '800' },
  leaderMiniLbl: { fontSize: 9, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  leaderExpandedList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    gap: 6,
  },
  leaderPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  leaderPersonName: { fontSize: 13, color: '#E2E8F0', fontWeight: '600' },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusTagText: { fontSize: 10, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 },
  modal: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  input: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});

