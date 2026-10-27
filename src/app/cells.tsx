import { useChurch } from '@/context/ChurchContext';
import { CellGroup, CellPersonItem, ChurchNetwork } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DoodleBackground } from '@/components/doodle-background';

let personIdCounter = 0;
function getNextPersonId(prefix: string): string {
  personIdCounter += 1;
  return `${prefix}_${personIdCounter}`;
}

export default function CellsScreen() {
  const {
    currentUser,
    getMyCellGroups,
    addCellGroup,
    getMyDisciples,
    getMyCellMeetingReports,
    addCellMeetingReport,
    getLeaderInCharge,
  } = useChurch();

  const leaderInCharge = getLeaderInCharge(currentUser);
  const cellGroups = getMyCellGroups();
  const myDisciples = getMyDisciples();
  const myCellReports = getMyCellMeetingReports();

  // Tab State: Células vs Reportes de Reunión
  const [activeTab, setActiveTab] = useState<'cells' | 'reports'>('cells');

  // Modal 1: Crear Célula
  const [modalVisible, setModalVisible] = useState(false);
  const [cellLeaderType, setCellLeaderType] = useState<'myself' | 'disciple'>('myself');
  const [cellLeaderName, setCellLeaderName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [hostName, setHostName] = useState('');
  const [address, setAddress] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<CellGroup['dayOfWeek']>('Miércoles');
  const [time, setTime] = useState('7:00 PM');
  const userNetwork: ChurchNetwork = currentUser?.network || 'juvenil';
  const [network, setNetwork] = useState<ChurchNetwork>(userNetwork);
  const [notes, setNotes] = useState('');

  // Modal 2: Reporte Semanal de Célula
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedCellForReport, setSelectedCellForReport] = useState<CellGroup | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // Lista detallada de miembros e invitados con Nombre y Edad
  const [membersList, setMembersList] = useState<CellPersonItem[]>([
    { id: 'm-init-1', name: '', age: '' },
  ]);
  const [visitorsList, setVisitorsList] = useState<CellPersonItem[]>([]);

  // Desglose de Ofrenda Múltiple (Dólares, Bs Efectivo, Pago Móvil + Ref)
  const [usdCash, setUsdCash] = useState('');
  const [vesCash, setVesCash] = useState('');
  const [pagoMovilAmount, setPagoMovilAmount] = useState('');
  const [pagoMovilReference, setPagoMovilReference] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  const days: CellGroup['dayOfWeek'][] = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  const myFullName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : 'Líder 12';

  const handleOpenModal = () => {
    setCellLeaderType('myself');
    setCellLeaderName(myFullName);
    setAssistantName('');
    setHostName('');
    setAddress('');
    setNotes('');
    setNetwork(userNetwork); // Red asignada automáticamente
    setModalVisible(true);
  };

  const handleSelectLeaderType = (type: 'myself' | 'disciple') => {
    setCellLeaderType(type);
    if (type === 'myself') {
      setCellLeaderName(myFullName);
    } else {
      setCellLeaderName('');
    }
  };

  const handleCreateCell = async () => {
    const finalLeaderName =
      cellLeaderType === 'myself' ? myFullName : cellLeaderName.trim();

    if (!finalLeaderName || !hostName.trim()) {
      Alert.alert(
        'Faltan Datos',
        'Por favor indica quién es el Líder de la Célula y el Anfitrión de la casa.'
      );
      return;
    }

    // Visión G12:
    // Si la dirijo yo (ej. Yonmar): la cobertura es mi pastor encargado (Pastor Josué)
    // Si la dirige uno de mis discípulos: la cobertura directa soy yo (Yonmar)
    const cellCoverageId = cellLeaderType === 'myself' ? leaderInCharge.id : (currentUser?.id || 'lider-temp');
    const cellCoverageName = cellLeaderType === 'myself' ? leaderInCharge.name : myFullName;

    await addCellGroup({
      cellLeaderName: finalLeaderName,
      leaderId: cellCoverageId,
      leaderName: cellCoverageName,
      assistantName: assistantName.trim() || undefined,
      hostName: hostName.trim(),
      address: address.trim() || undefined,
      dayOfWeek,
      time: time.trim() || '7:00 PM',
      network,
      membersCount: 1,
      notes: notes.trim() || undefined,
    });

    setModalVisible(false);

    Alert.alert(
      '¡Célula Registrada!',
      `La célula a cargo de ${finalLeaderName} ha sido agregada a tu red celular.`
    );
  };

  // Open Report Modal for a specific cell
  const handleOpenReportModal = (cell: CellGroup) => {
    setSelectedCellForReport(cell);
    setMembersList([{ id: getNextPersonId('m'), name: '', age: '' }]);
    setVisitorsList([]);
    setUsdCash('');
    setVesCash('');
    setPagoMovilAmount('');
    setPagoMovilReference('');
    setReportNotes('');
    setReportDate(new Date().toISOString().split('T')[0]);
    setReportModalVisible(true);
  };

  // Add / Remove Member item
  const handleAddMemberItem = (name: string = '') => {
    setMembersList((prev) => [
      ...prev,
      { id: getNextPersonId('m'), name, age: '' },
    ]);
  };

  const handleUpdateMemberItem = (id: string, field: 'name' | 'age', value: string) => {
    setMembersList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveMemberItem = (id: string) => {
    if (membersList.length === 1) {
      setMembersList([{ id: getNextPersonId('m'), name: '', age: '' }]);
    } else {
      setMembersList((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Add / Remove Visitor item
  const handleAddVisitorItem = () => {
    setVisitorsList((prev) => [
      ...prev,
      { id: getNextPersonId('v'), name: '', age: '' },
    ]);
  };

  const handleUpdateVisitorItem = (id: string, field: 'name' | 'age', value: string) => {
    setVisitorsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveVisitorItem = (id: string) => {
    setVisitorsList((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit the meeting report
  const handleSubmitCellReport = async () => {
    if (!selectedCellForReport) return;

    const validMembers = membersList.filter((m) => m.name.trim().length > 0);
    const validVisitors = visitorsList.filter((v) => v.name.trim().length > 0);

    const usd = parseFloat(usdCash.replace(',', '.')) || 0;
    const ves = parseFloat(vesCash.replace(',', '.')) || 0;
    const pm = parseFloat(pagoMovilAmount.replace(',', '.')) || 0;

    if (validMembers.length === 0 && validVisitors.length === 0) {
      Alert.alert(
        'Faltan Asistentes',
        'Por favor ingresa al menos un miembro o invitado asistente con su nombre y edad.'
      );
      return;
    }

    if (pm > 0 && !pagoMovilReference.trim()) {
      Alert.alert(
        'Falta Referencia',
        'Ingresaste un monto de Pago Móvil. Por favor coloca el número de referencia de la transferencia.'
      );
      return;
    }

    const totalCalculated = usd + (ves > 0 ? ves : 0) + (pm > 0 ? pm : 0);

    await addCellMeetingReport({
      cellId: selectedCellForReport.id,
      cellLeaderName: selectedCellForReport.cellLeaderName,
      leaderId: selectedCellForReport.leaderId,
      leaderName: selectedCellForReport.leaderName,
      recipientLeaderId: leaderInCharge.id,
      recipientLeaderName: leaderInCharge.name,
      hostName: selectedCellForReport.hostName,
      assistantName: selectedCellForReport.assistantName,
      network: selectedCellForReport.network,
      date: reportDate,
      membersCount: validMembers.length,
      membersList: validMembers,
      visitorsCount: validVisitors.length,
      visitorsList: validVisitors,
      offering: totalCalculated,
      offeringDetails: {
        usdCash: usd > 0 ? usd : undefined,
        vesCash: ves > 0 ? ves : undefined,
        pagoMovilAmount: pm > 0 ? pm : undefined,
        pagoMovilReference: pagoMovilReference.trim() || undefined,
      },
      notes: reportNotes.trim() || undefined,
    });

    setReportModalVisible(false);

    Alert.alert(
      '¡Reporte de Célula Enviado!',
      `Se registró la reunión de la Célula de ${selectedCellForReport.cellLeaderName} y fue enviado exitosamente a tu pastor/líder encargado: ${leaderInCharge.name}.`
    );
  };

  // Calculations for Reports Summary
  const totalUsdOffering = myCellReports.reduce(
    (acc, r) => acc + (r.offeringDetails?.usdCash || (r.offeringDetails ? 0 : r.offering || 0)),
    0
  );
  const totalVesOffering = myCellReports.reduce(
    (acc, r) => acc + (r.offeringDetails?.vesCash || 0),
    0
  );
  const totalPmOffering = myCellReports.reduce(
    (acc, r) => acc + (r.offeringDetails?.pagoMovilAmount || 0),
    0
  );
  const totalReportedMembers = myCellReports.reduce((acc, r) => acc + (r.membersCount || 0), 0);
  const totalReportedVisitors = myCellReports.reduce((acc, r) => acc + (r.visitorsCount || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <DoodleBackground>

      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <Ionicons name="git-network" size={14} color="#2563EB" />
            <Text style={styles.badgeText}>
              {userNetwork === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>Gestión Celular</Text>
          <Text style={styles.headerSubtitle}>
            Cobertura espiritual • {myFullName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleOpenModal}
          activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* View Switcher Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'cells' && styles.tabButtonActive]}
          onPress={() => setActiveTab('cells')}
          activeOpacity={0.8}>
          <Ionicons
            name="git-network"
            size={16}
            color={activeTab === 'cells' ? '#1E3A8A' : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'cells' && styles.tabButtonTextActive]}>
            Mis Células ({cellGroups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reports')}
          activeOpacity={0.8}>
          <Ionicons
            name="document-text"
            size={16}
            color={activeTab === 'reports' ? '#1E3A8A' : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'reports' && styles.tabButtonTextActive]}>
            Reportes ({myCellReports.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================= */}
        {/* TAB 1: LIST OF CELLS                                      */}
        {/* ========================================================= */}
        {activeTab === 'cells' && (
          <View>
            {/* Info Banner on Multiplication */}
            <View style={styles.explanationBanner}>
              <Ionicons name="information-circle" size={22} color="#1E3A8A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.explanationTitle}>Multiplicación Celular</Text>
                <Text style={styles.explanationText}>
                  Como líder de 12, tú realizas una célula y tus discípulos multiplican las demás bajo tu cobertura.
                </Text>
              </View>
            </View>

            {/* Metric Summary Card */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { borderLeftColor: '#3B82F6' }]}>
                <Text style={styles.metricNumber}>{cellGroups.length}</Text>
                <Text style={styles.metricLabel}>Total Células</Text>
                <Text style={styles.metricSub}>1 tuya + {Math.max(0, cellGroups.length - 1)} de discípulos</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: '#10B981' }]}>
                <Text style={styles.metricNumber}>
                  {cellGroups.reduce((acc, c) => acc + (c.membersCount || 0), 0)}
                </Text>
                <Text style={styles.metricLabel}>Asistentes Promedio</Text>
                <Text style={styles.metricSub}>Almas consolidadas</Text>
              </View>
            </View>

            {/* Empty State */}
            {cellGroups.length === 0 && (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="people" size={40} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>Aún no has registrado células</Text>
                <Text style={styles.emptySubtitle}>
                  Agrega tu célula principal o las células que dirigen tus discípulos para que tu pastor tenga el reporte general.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleOpenModal}
                  activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Registrar Célula</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List of Cells */}
            {cellGroups.map((cell) => {
              // 1. ¿Quién dirige la célula?
              // Comparamos el nombre del líder de la célula con el usuario logueado actualmente
              const cleanUser = myFullName.trim().toLowerCase().replace(/^(pastor|pastora|líder)\s+/i, '');
              const cleanCellLeader = cell.cellLeaderName.trim().toLowerCase().replace(/^(pastor|pastora|líder)\s+/i, '');
              const isDirectlyLed = cleanUser.length > 0 && cleanCellLeader === cleanUser;

              // 2. Cobertura efectiva de la célula
              let effectiveCoverage = cell.leaderName;
              if (
                cleanCellLeader.includes('yonmar') &&
                (!effectiveCoverage || effectiveCoverage.toLowerCase().includes('yonmar'))
              ) {
                effectiveCoverage = 'Pastor Josué Rodríguez';
              }

              // ¿El usuario logueado es la cobertura de esta célula?
              const isUnderMyCoverage =
                cell.leaderId === currentUser?.id ||
                effectiveCoverage.toLowerCase().includes(currentUser?.firstName.toLowerCase() || '');

              return (
                <View key={cell.id} style={styles.cellCard}>
                  <View style={styles.cellHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cellName}>Célula de {cell.cellLeaderName}</Text>
                      <Text style={styles.cellLeaderRole}>
                        {isDirectlyLed
                          ? '👑 Dirigida personalmente por ti'
                          : `🌱 Dirigida por tu discípulo: ${cell.cellLeaderName}`}
                      </Text>
                      <Text style={styles.cellCoverageText}>
                        {isUnderMyCoverage
                          ? `🛡️ Bajo tu cobertura pastoral (${effectiveCoverage})`
                          : `🛡️ Bajo cobertura de: ${effectiveCoverage}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.networkBadge,
                        { backgroundColor: cell.network === 'juvenil' ? '#EDE9FE' : '#DBEAFE' },
                      ]}>
                      <Text
                        style={[
                          styles.networkBadgeText,
                          { color: cell.network === 'juvenil' ? '#7C3AED' : '#1D4ED8' },
                        ]}>
                        {cell.network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
                      </Text>
                    </View>
                  </View>

                  {/* Cell Details Grid */}
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="person" size={15} color="#2563EB" />
                      <Text style={styles.detailText}>
                        <Text style={{ fontWeight: '700' }}>Líder: </Text>
                        {cell.cellLeaderName}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Ionicons name="home-outline" size={15} color="#059669" />
                      <Text style={styles.detailText}>
                        <Text style={{ fontWeight: '700' }}>Anfitrión: </Text>
                        {cell.hostName}
                      </Text>
                    </View>

                    {cell.assistantName && (
                      <View style={styles.detailItem}>
                        <Ionicons name="sparkles-outline" size={15} color="#F59E0B" />
                        <Text style={styles.detailText}>
                          <Text style={{ fontWeight: '700' }}>Asistente: </Text>
                          {cell.assistantName}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={15} color="#64748B" />
                      <Text style={styles.detailText}>
                        {cell.dayOfWeek} a las {cell.time}
                      </Text>
                    </View>

                    {cell.address && (
                      <View style={styles.detailItem}>
                        <Ionicons name="location-outline" size={15} color="#64748B" />
                        <Text style={styles.detailText}>{cell.address}</Text>
                      </View>
                    )}
                  </View>

                  {cell.notes && (
                    <View style={styles.cellNotes}>
                      <Text style={styles.cellNotesText}>{cell.notes}</Text>
                    </View>
                  )}

                  {/* Card Action Footer */}
                  <View style={styles.cardFooter}>
                    <View style={styles.membersCountPill}>
                      <Ionicons name="people" size={14} color="#059669" />
                      <Text style={styles.membersCountText}>
                        {cell.membersCount || 0} personas
                      </Text>
                    </View>

                    {/* Report Meeting Button */}
                    <TouchableOpacity
                      style={styles.reportCellBtn}
                      onPress={() => handleOpenReportModal(cell)}
                      activeOpacity={0.85}>
                      <Ionicons name="clipboard-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.reportCellBtnText}>Reportar Reunión</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CELL MEETING REPORTS                               */}
        {/* ========================================================= */}
        {activeTab === 'reports' && (
          <View>
            {/* Reports Financial & Growth Metrics */}
            <View style={styles.multiOfferingSummaryCard}>
              <Text style={styles.offeringSummaryTitle}>💰 Ofrendas Recolectadas en Células</Text>
              <View style={styles.offeringBreakdownRow}>
                <View style={styles.offeringBadgeItem}>
                  <Text style={styles.offeringBadgeLbl}>💵 Dólares Efectivo:</Text>
                  <Text style={styles.offeringBadgeVal}>${totalUsdOffering.toFixed(2)}</Text>
                </View>

                {totalVesOffering > 0 && (
                  <View style={styles.offeringBadgeItem}>
                    <Text style={styles.offeringBadgeLbl}>🇻🇪 Bs. Efectivo:</Text>
                    <Text style={styles.offeringBadgeVal}>Bs. {totalVesOffering.toFixed(2)}</Text>
                  </View>
                )}

                {totalPmOffering > 0 && (
                  <View style={styles.offeringBadgeItem}>
                    <Text style={styles.offeringBadgeLbl}>📲 Pago Móvil:</Text>
                    <Text style={styles.offeringBadgeVal}>Bs. {totalPmOffering.toFixed(2)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.offeringAttendanceDivider} />
              <View style={styles.offeringAttendanceRow}>
                <Text style={styles.offeringAttendanceText}>
                  👥 <Text style={{ fontWeight: '700' }}>{totalReportedMembers}</Text> miembros reportados • ✨ <Text style={{ fontWeight: '700' }}>{totalReportedVisitors}</Text> invitados nuevos
                </Text>
              </View>
            </View>

            {/* Destination / Inbox Banner */}
            <View style={styles.inboxBanner}>
              <Ionicons name="paper-plane" size={16} color="#2563EB" />
              <Text style={styles.inboxBannerText}>
                {currentUser?.role === 'network_pastor' || currentUser?.role === 'senior_pastor'
                  ? 'Bandeja Pastoral: Mostrando reportes recibidos de tu red celular y tus discípulos.'
                  : `Tus reportes son enviados directamente a tu pastor/líder encargado: ${leaderInCharge.name}.`}
              </Text>
            </View>

            {myCellReports.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="receipt-outline" size={38} color="#D97706" />
                </View>
                <Text style={styles.emptyTitle}>Sin reportes de reunión aún</Text>
                <Text style={styles.emptySubtitle}>
                  Ve a la pestaña &ldquo;Mis Células&rdquo; y presiona el botón &ldquo;Reportar Reunión&rdquo; en cualquiera de tus células para reportar miembros, invitados con nombre y edad, y ofrenda múltiple.
                </Text>
              </View>
            ) : (
              myCellReports.map((rep) => (
                <View key={rep.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle}>Célula de {rep.cellLeaderName}</Text>
                      <Text style={styles.reportDateText}>
                        Fecha de la reunión: {rep.date}
                      </Text>
                      <View style={styles.recipientBadgeRow}>
                        <Ionicons name="paper-plane-outline" size={12} color="#2563EB" />
                        <Text style={styles.recipientBadgeText}>
                          Enviado a: <Text style={{ fontWeight: '700' }}>{rep.recipientLeaderName || leaderInCharge.name}</Text>
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={styles.recapTag}>
                        <Text style={styles.recapTagText}>
                          {rep.network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
                        </Text>
                      </View>
                      {(currentUser?.id === rep.recipientLeaderId || currentUser?.role === 'network_pastor' || currentUser?.role === 'senior_pastor') && (
                        <View style={styles.receivedBadge}>
                          <Ionicons name="checkmark-done" size={11} color="#059669" />
                          <Text style={styles.receivedBadgeText}>Recibido</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Pre-registered cell data recap */}
                  <View style={styles.reportRecapGrid}>
                    <View style={styles.recapItem}>
                      <Text style={styles.recapLabel}>🏠 Anfitrión:</Text>
                      <Text style={styles.recapVal}>{rep.hostName}</Text>
                    </View>
                    {rep.assistantName && (
                      <View style={styles.recapItem}>
                        <Text style={styles.recapLabel}>🤝 Asistente:</Text>
                        <Text style={styles.recapVal}>{rep.assistantName}</Text>
                      </View>
                    )}
                  </View>

                  {/* Miembros Asistentes (con Nombre y Edad) */}
                  <View style={styles.peopleSectionCard}>
                    <View style={styles.peopleSectionHeader}>
                      <Ionicons name="people" size={15} color="#2563EB" />
                      <Text style={styles.peopleSectionTitle}>
                        Miembros Asistentes ({rep.membersCount}):
                      </Text>
                    </View>
                    {rep.membersList && rep.membersList.length > 0 ? (
                      <View style={styles.peopleChipsWrap}>
                        {rep.membersList.map((m) => (
                          <View key={m.id} style={styles.personChip}>
                            <Text style={styles.personChipName}>{m.name}</Text>
                            {m.age ? (
                              <Text style={styles.personChipAge}>({m.age} años)</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.peopleCountFallback}>
                        {rep.membersCount} miembros asistentes reportados
                      </Text>
                    )}
                  </View>

                  {/* Invitados Nuevos (con Nombre y Edad) */}
                  {rep.visitorsCount > 0 && (
                    <View style={[styles.peopleSectionCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                      <View style={styles.peopleSectionHeader}>
                        <Ionicons name="sparkles" size={15} color="#7C3AED" />
                        <Text style={[styles.peopleSectionTitle, { color: '#6D28D9' }]}>
                          Invitados Nuevos ({rep.visitorsCount}):
                        </Text>
                      </View>
                      {rep.visitorsList && rep.visitorsList.length > 0 ? (
                        <View style={styles.peopleChipsWrap}>
                          {rep.visitorsList.map((v) => (
                            <View key={v.id} style={[styles.personChip, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                              <Text style={[styles.personChipName, { color: '#5B21B6' }]}>{v.name}</Text>
                              {v.age ? (
                                <Text style={[styles.personChipAge, { color: '#7C3AED' }]}>({v.age} años)</Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.peopleCountFallback}>
                          {rep.visitorsCount} invitados nuevos
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Desglose de Ofrenda Múltiple */}
                  <View style={styles.offeringBreakdownCard}>
                    <Text style={styles.offeringBreakdownHeader}>Desglose de Ofrenda:</Text>
                    <View style={styles.offeringItemsRow}>
                      {rep.offeringDetails?.usdCash ? (
                        <View style={styles.offeringItemPill}>
                          <Text style={styles.offeringItemText}>
                            💵 Dólares: <Text style={{ fontWeight: '800' }}>${rep.offeringDetails.usdCash.toFixed(2)}</Text>
                          </Text>
                        </View>
                      ) : null}

                      {rep.offeringDetails?.vesCash ? (
                        <View style={styles.offeringItemPill}>
                          <Text style={styles.offeringItemText}>
                            🇻🇪 Bs. Efectivo: <Text style={{ fontWeight: '800' }}>Bs. {rep.offeringDetails.vesCash.toFixed(2)}</Text>
                          </Text>
                        </View>
                      ) : null}

                      {rep.offeringDetails?.pagoMovilAmount ? (
                        <View style={styles.offeringItemPill}>
                          <Text style={styles.offeringItemText}>
                            📲 Pago Móvil: <Text style={{ fontWeight: '800' }}>Bs. {rep.offeringDetails.pagoMovilAmount.toFixed(2)}</Text>
                            {rep.offeringDetails.pagoMovilReference ? ` (Ref: ${rep.offeringDetails.pagoMovilReference})` : ''}
                          </Text>
                        </View>
                      ) : null}

                      {!rep.offeringDetails?.usdCash && !rep.offeringDetails?.vesCash && !rep.offeringDetails?.pagoMovilAmount && rep.offering > 0 && (
                        <View style={styles.offeringItemPill}>
                          <Text style={styles.offeringItemText}>
                            Total Ofrenda: <Text style={{ fontWeight: '800' }}>${rep.offering.toFixed(2)}</Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Notes / Observaciones */}
                  {rep.notes && (
                    <View style={styles.reportNotesBox}>
                      <Text style={styles.reportNotesLabel}>Observaciones:</Text>
                      <Text style={styles.reportNotesText}>&ldquo;{rep.notes}&rdquo;</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR NUEVA CÉLULA                           */}
      {/* ========================================================= */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Registrar Célula</Text>
                <Text style={styles.modalSubtitle}>Grupo celular bajo tu liderazgo</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Leader in Charge Pill */}
              <View style={styles.leaderPill}>
                <Ionicons name="shield-checkmark" size={18} color="#1E3A8A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderPillTitle}>
                    {cellLeaderType === 'myself'
                      ? 'Líder de Cobertura de tu Célula:'
                      : 'Líder de Cobertura (Tú):'}
                  </Text>
                  <Text style={styles.leaderPillName}>
                    {cellLeaderType === 'myself'
                      ? `${leaderInCharge.name} (Tu Pastor)`
                      : `${myFullName} (Tú)`}
                  </Text>
                </View>
              </View>

              {/* Red asignada automáticamente */}
              <View style={styles.networkLockedBanner}>
                <Ionicons
                  name={userNetwork === 'juvenil' ? 'sparkles' : 'people'}
                  size={16}
                  color={userNetwork === 'juvenil' ? '#7C3AED' : '#1D4ED8'}
                />
                <Text
                  style={[
                    styles.networkLockedText,
                    { color: userNetwork === 'juvenil' ? '#6D28D9' : '#1E3A8A' },
                  ]}>
                  {userNetwork === 'juvenil'
                    ? 'Red Juvenil (Asignada automáticamente)'
                    : 'Red Adulta (Asignada automáticamente)'}
                </Text>
              </View>

              {/* Who leads this cell? (Myself vs Disciple) */}
              <Text style={styles.inputLabel}>¿Quién dirige esta célula? *</Text>
              <View style={styles.leaderTypeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.leaderTypeBtn,
                    cellLeaderType === 'myself' && styles.leaderTypeBtnActive,
                  ]}
                  onPress={() => handleSelectLeaderType('myself')}>
                  <Ionicons
                    name="person"
                    size={16}
                    color={cellLeaderType === 'myself' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.leaderTypeText,
                      cellLeaderType === 'myself' && styles.leaderTypeTextActive,
                    ]}>
                    Yo mismo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.leaderTypeBtn,
                    cellLeaderType === 'disciple' && styles.leaderTypeBtnActive,
                  ]}
                  onPress={() => handleSelectLeaderType('disciple')}>
                  <Ionicons
                    name="people"
                    size={16}
                    color={cellLeaderType === 'disciple' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.leaderTypeText,
                      cellLeaderType === 'disciple' && styles.leaderTypeTextActive,
                    ]}>
                    Uno de mis Discípulos
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cell Leader Input */}
              {cellLeaderType === 'disciple' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Nombre del Líder de Célula (Discípulo) *</Text>

                  {myDisciples.length > 0 && (
                    <View style={styles.discipleChipsRow}>
                      <Text style={styles.miniHint}>Sugerir de tus discípulos:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {myDisciples.map((d) => (
                          <TouchableOpacity
                            key={d.id}
                            style={[
                              styles.discipleChip,
                              cellLeaderName === `${d.firstName} ${d.lastName}` &&
                              styles.discipleChipActive,
                            ]}
                            onPress={() => setCellLeaderName(`${d.firstName} ${d.lastName}`)}>
                            <Text
                              style={[
                                styles.discipleChipText,
                                cellLeaderName === `${d.firstName} ${d.lastName}` &&
                                styles.discipleChipTextActive,
                              ]}>
                              {d.firstName} {d.lastName}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TextInput
                    style={styles.modalInput}
                    placeholder="Escribe el nombre del líder de célula"
                    placeholderTextColor="#94A3B8"
                    value={cellLeaderName}
                    onChangeText={setCellLeaderName}
                  />
                </View>
              )}

              {/* Host */}
              <Text style={styles.inputLabel}>Anfitrión (Dueño de la Casa) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Familia Morales / Hno. Roberto Valbuena"
                placeholderTextColor="#94A3B8"
                value={hostName}
                onChangeText={setHostName}
              />

              {/* Assistant */}
              <Text style={styles.inputLabel}>Asistente / Timoteo (Opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nombre de quien le asiste en la célula"
                placeholderTextColor="#94A3B8"
                value={assistantName}
                onChangeText={setAssistantName}
              />

              {/* Address */}
              <Text style={styles.inputLabel}>Dirección / Casa</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Urb. Las Mercedes, Calle 4, Casa #12"
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
              />

              {/* Day of Week Selector */}
              <Text style={styles.inputLabel}>Día de la Semana *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {days.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayPill, dayOfWeek === d && styles.dayPillActive]}
                    onPress={() => setDayOfWeek(d)}>
                    <Text
                      style={[styles.dayPillText, dayOfWeek === d && styles.dayPillTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time */}
              <Text style={styles.inputLabel}>Hora de Inicio *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: 7:00 PM o 19:00"
                placeholderTextColor="#94A3B8"
                value={time}
                onChangeText={setTime}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Observaciones / Notas</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Peticiones o notas de este grupo celular..."
                placeholderTextColor="#94A3B8"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              {/* Submit Modal Button */}
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleCreateCell}
                activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Guardar Célula en mi Red</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: REPORTE DE REUNIÓN DE CÉLULA                     */}
      {/* Con Miembros e Invitados (Nombre y Edad) y Ofrenda Múltiple */}
      {/* ========================================================= */}
      <Modal visible={reportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reporte de Célula</Text>
                <Text style={styles.modalSubtitle}>
                  Reporte de reunión semanal con asistentes y ofrendas
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {selectedCellForReport && (
                <View style={styles.reportCellDetailsCard}>
                  <Text style={styles.reportCellTitle}>
                    Célula de {selectedCellForReport.cellLeaderName}
                  </Text>
                  <View style={styles.reportCellMetaRow}>
                    <Text style={styles.reportCellMetaText}>
                      🏠 Anfitrión: <Text style={{ fontWeight: '700' }}>{selectedCellForReport.hostName}</Text>
                    </Text>
                    {selectedCellForReport.assistantName && (
                      <Text style={styles.reportCellMetaText}>
                        🤝 Asistente: <Text style={{ fontWeight: '700' }}>{selectedCellForReport.assistantName}</Text>
                      </Text>
                    )}
                    <Text style={styles.reportCellMetaText}>
                      📍 Red: {selectedCellForReport.network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Destinatario del Reporte */}
              <View style={styles.recipientBanner}>
                <Ionicons name="paper-plane" size={16} color="#2563EB" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.recipientBannerTitle}>Líder Encargado (Recibe este Reporte):</Text>
                  <Text style={styles.recipientBannerName}>
                    {leaderInCharge.name} ({currentUser?.network === 'juvenil' ? 'Pastor de Jóvenes' : 'Cobertura Pastoral'})
                  </Text>
                </View>
              </View>

              {/* Fecha de la Reunión */}
              <Text style={styles.inputLabel}>Fecha de la Reunión (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.modalInput}
                value={reportDate}
                onChangeText={setReportDate}
                placeholder="2026-10-21"
                placeholderTextColor="#94A3B8"
              />

              {/* -------------------------------------------------- */}
              {/* SECCIÓN 1: MIEMBROS ASISTENTES CON NOMBRE Y EDAD   */}
              {/* -------------------------------------------------- */}
              <View style={styles.formSectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionFormTitle}>1. Miembros Asistentes ({membersList.length})</Text>
                    <Text style={styles.miniHint}>Escribe el nombre y la edad de cada miembro que asistió:</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addItemBtn}
                    onPress={() => handleAddMemberItem()}
                    activeOpacity={0.8}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.addItemBtnText}>Agregar</Text>
                  </TouchableOpacity>
                </View>

                {/* Disciple suggestions */}
                {myDisciples.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.suggestionTitle}>Sugerir de mis discípulos directos:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {myDisciples.map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          style={styles.suggestionChip}
                          onPress={() => handleAddMemberItem(`${d.firstName} ${d.lastName}`)}>
                          <Text style={styles.suggestionChipText}>+ {d.firstName} {d.lastName}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {membersList.map((m, index) => (
                  <View key={m.id} style={styles.personInputRow}>
                    <View style={styles.personIndexCircle}>
                      <Text style={styles.personIndexText}>{index + 1}</Text>
                    </View>
                    <TextInput
                      style={[styles.modalInput, { flex: 2, marginRight: 6 }]}
                      placeholder="Nombre y apellido"
                      placeholderTextColor="#94A3B8"
                      value={m.name}
                      onChangeText={(val) => handleUpdateMemberItem(m.id, 'name', val)}
                    />
                    <TextInput
                      style={[styles.modalInput, { width: 68, textAlign: 'center', marginRight: 6 }]}
                      placeholder="Edad"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={m.age}
                      onChangeText={(val) => handleUpdateMemberItem(m.id, 'age', val)}
                    />
                    <TouchableOpacity
                      style={styles.removeRowBtn}
                      onPress={() => handleRemoveMemberItem(m.id)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* -------------------------------------------------- */}
              {/* SECCIÓN 2: INVITADOS NUEVOS CON NOMBRE Y EDAD      */}
              {/* -------------------------------------------------- */}
              <View style={[styles.formSectionContainer, { borderColor: '#E9D5FF' }]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionFormTitle, { color: '#6D28D9' }]}>
                      2. Invitados Nuevos ({visitorsList.length})
                    </Text>
                    <Text style={styles.miniHint}>Personas alcanzadas o nuevas que asistieron:</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addItemBtn, { backgroundColor: '#7C3AED' }]}
                    onPress={handleAddVisitorItem}
                    activeOpacity={0.8}>
                    <Ionicons name="person-add" size={15} color="#FFFFFF" />
                    <Text style={styles.addItemBtnText}>+ Invitado</Text>
                  </TouchableOpacity>
                </View>

                {visitorsList.length === 0 ? (
                  <TouchableOpacity
                    style={styles.addFirstVisitorBox}
                    onPress={handleAddVisitorItem}
                    activeOpacity={0.7}>
                    <Ionicons name="add-circle-outline" size={20} color="#7C3AED" />
                    <Text style={styles.addFirstVisitorText}>
                      ¿Tuviste invitados nuevos? Toca aquí para agregarlos
                    </Text>
                  </TouchableOpacity>
                ) : (
                  visitorsList.map((v, index) => (
                    <View key={v.id} style={styles.personInputRow}>
                      <View style={[styles.personIndexCircle, { backgroundColor: '#EDE9FE' }]}>
                        <Text style={[styles.personIndexText, { color: '#6D28D9' }]}>{index + 1}</Text>
                      </View>
                      <TextInput
                        style={[styles.modalInput, { flex: 2, marginRight: 6 }]}
                        placeholder="Nombre del invitado"
                        placeholderTextColor="#94A3B8"
                        value={v.name}
                        onChangeText={(val) => handleUpdateVisitorItem(v.id, 'name', val)}
                      />
                      <TextInput
                        style={[styles.modalInput, { width: 68, textAlign: 'center', marginRight: 6 }]}
                        placeholder="Edad"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={v.age}
                        onChangeText={(val) => handleUpdateVisitorItem(v.id, 'age', val)}
                      />
                      <TouchableOpacity
                        style={styles.removeRowBtn}
                        onPress={() => handleRemoveVisitorItem(v.id)}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {/* -------------------------------------------------- */}
              {/* SECCIÓN 3: OFRENDA MÚLTIPLE ($, BS Y PAGO MÓVIL)   */}
              {/* -------------------------------------------------- */}
              <View style={[styles.formSectionContainer, { borderColor: '#A7F3D0' }]}>
                <Text style={[styles.sectionFormTitle, { color: '#047857' }]}>
                  3. Ofrenda Recolectada (Múltiples Métodos)
                </Text>
                <Text style={styles.miniHint}>
                  Puedes registrar en Dólares, Bolívares en efectivo y/o Pago Móvil:
                </Text>

                {/* Opción A: Dólares en Efectivo */}
                <Text style={styles.subInputLabel}>💵 Dólares en Efectivo ($ USD):</Text>
                <View style={styles.moneyInputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.moneyInput}
                    keyboardType="numeric"
                    value={usdCash}
                    onChangeText={setUsdCash}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Opción B: Bolívares en Efectivo */}
                <Text style={styles.subInputLabel}>🇻🇪 Bolívares en Efectivo (Bs):</Text>
                <View style={styles.moneyInputWrapper}>
                  <Text style={[styles.currencySymbol, { color: '#2563EB' }]}>Bs.</Text>
                  <TextInput
                    style={styles.moneyInput}
                    keyboardType="numeric"
                    value={vesCash}
                    onChangeText={setVesCash}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Opción C: Pago Móvil (Monto + Referencia) */}
                <Text style={styles.subInputLabel}>📲 Pago Móvil (PM):</Text>
                <View style={styles.pagoMovilBox}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.pmMiniLabel}>Monto (Bs):</Text>
                    <View style={styles.moneyInputWrapper}>
                      <Text style={[styles.currencySymbol, { color: '#7C3AED' }]}>Bs.</Text>
                      <TextInput
                        style={styles.moneyInput}
                        keyboardType="numeric"
                        value={pagoMovilAmount}
                        onChangeText={setPagoMovilAmount}
                        placeholder="0.00"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.pmMiniLabel}>Nº Referencia:</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={pagoMovilReference}
                      onChangeText={setPagoMovilReference}
                      placeholder="Ej: 8492"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              {/* Observaciones */}
              <Text style={styles.inputLabel}>4. Observaciones de la Reunión</Text>
              <TextInput
                style={[styles.modalInput, { height: 75 }]}
                placeholder="¿Cómo estuvo la presencia de Dios? ¿Hubo peticiones o decisiones de fe?"
                placeholderTextColor="#94A3B8"
                multiline
                value={reportNotes}
                onChangeText={setReportNotes}
              />

              {/* Submit Report Button */}
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: '#059669', marginTop: 16 }]}
                onPress={handleSubmitCellReport}
                activeOpacity={0.85}>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>Enviar Reporte a mi Pastor</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      </DoodleBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  addButton: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#1E3A8A',
  },
  explanationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  explanationText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cellCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cellName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cellLeaderRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  cellCoverageText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  networkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  networkBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsGrid: {
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#334155',
  },
  cellNotes: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  cellNotesText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 4,
  },
  membersCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  membersCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  reportCellBtn: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  reportCellBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  // Multi Offering Summary Card
  multiOfferingSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  offeringSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  offeringBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offeringBadgeItem: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  offeringBadgeLbl: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  offeringBadgeVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  offeringAttendanceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  offeringAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offeringAttendanceText: {
    fontSize: 12,
    color: '#475569',
  },
  // Reports Tab Styles
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportDateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  recapTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recapTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  reportRecapGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  recapItem: {
    flexDirection: 'row',
    gap: 4,
  },
  recapLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  recapVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  peopleSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  peopleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  peopleSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  peopleChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  personChipName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  personChipAge: {
    fontSize: 10,
    color: '#3B82F6',
  },
  peopleCountFallback: {
    fontSize: 11,
    color: '#64748B',
  },
  offeringBreakdownCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  offeringBreakdownHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  offeringItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  offeringItemPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offeringItemText: {
    fontSize: 11,
    color: '#047857',
  },
  reportNotesBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  reportNotesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  reportNotesText: {
    fontSize: 11,
    color: '#334155',
    fontStyle: 'italic',
  },
  // Modal Common Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalScroll: {
    marginTop: 14,
  },
  leaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  leaderPillTitle: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  leaderPillName: {
    color: '#1E3A8A',
    fontWeight: '800',
    fontSize: 13,
  },
  networkLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  networkLockedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 3,
  },
  leaderTypeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 4,
  },
  leaderTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  leaderTypeBtnActive: {
    backgroundColor: '#1E3A8A',
  },
  leaderTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  leaderTypeTextActive: {
    color: '#FFFFFF',
  },
  miniHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  discipleChipsRow: {
    marginBottom: 8,
  },
  discipleChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  discipleChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  discipleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  discipleChipTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  dayScroll: {
    marginBottom: 6,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  dayPillActive: {
    backgroundColor: '#1E3A8A',
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  modalSubmitButton: {
    marginTop: 20,
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  // Form Sections inside Report Modal
  formSectionContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionTitle: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  suggestionChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  suggestionChipText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  personInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  personIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  personIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  removeRowBtn: {
    padding: 6,
  },
  addFirstVisitorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DDD6FE',
  },
  addFirstVisitorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
  },
  // Report Modal Specific Styles
  reportCellDetailsCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reportCellTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  reportCellMetaRow: {
    gap: 2,
  },
  reportCellMetaText: {
    fontSize: 12,
    color: '#3B82F6',
  },
  moneyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    marginRight: 6,
  },
  moneyInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pagoMovilBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pmMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 3,
  },
  recipientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  recipientBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recipientBannerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
    marginTop: 1,
  },
  inboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  inboxBannerText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  recipientBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  recipientBadgeText: {
    fontSize: 12,
    color: '#2563EB',
  },
  receivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  receivedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
});
