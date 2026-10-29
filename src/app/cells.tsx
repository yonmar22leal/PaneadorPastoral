import { useChurch } from '@/context/ChurchContext';
import { CellGroup, CellMeetingReport, CellPersonItem, ChurchNetwork } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
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
    members,
    getMyCellGroups,
    addCellGroup,
    getMyDisciples,
    getMyCellMeetingReports,
    addCellMeetingReport,
    getLeaderInCharge,
  } = useChurch();

  const isPastor = currentUser?.role === 'senior_pastor';

  const leaderInCharge = getLeaderInCharge(currentUser);
  const cellGroups = getMyCellGroups();
  const myDisciples = getMyDisciples();
  const myCellReports = getMyCellMeetingReports();

  // Tab State: Células vs Reportes de Reunión
  const [activeTab, setActiveTab] = useState<'cells' | 'reports'>('cells');

  // Modo de visualización de reportes (Planilla Excel para Pastores por defecto)
  const [reportsViewMode, setReportsViewMode] = useState<'sheet' | 'cards'>(
    isPastor ? 'sheet' : 'cards'
  );
  const [sheetNetworkFilter, setSheetNetworkFilter] = useState<'all' | 'juvenil' | 'adulta'>('all');
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');

  // Modal 1: Crear Célula
  const [modalVisible, setModalVisible] = useState(false);
  const [cellLeaderType, setCellLeaderType] = useState<'myself' | 'disciple'>('myself');
  const [cellLeaderName, setCellLeaderName] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [hostName, setHostName] = useState('');
  const [address, setAddress] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<CellGroup['dayOfWeek']>('Miércoles');
  const [time, setTime] = useState('7:00 PM');
  const userNetwork: ChurchNetwork = 'general';
  const [network, setNetwork] = useState<ChurchNetwork>('general');
  const [notes, setNotes] = useState('');

  // Modal 2: Reporte Semanal de Célula
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedCellForReport, setSelectedCellForReport] = useState<CellGroup | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportTopic, setReportTopic] = useState('El tiempo de la sequía a terminado');
  const [reportConversions, setReportConversions] = useState('0');
  const [reportStatus, setReportStatus] = useState<'realizada' | 'no_asistio_nadie' | 'no_realizo'>(
    'realizada'
  );

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
    setReportTopic('El tiempo de la sequía a terminado');
    setReportConversions('0');
    setReportStatus('realizada');
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

    if (reportStatus === 'realizada' && validMembers.length === 0 && validVisitors.length === 0) {
      Alert.alert(
        'Faltan Asistentes',
        'Por favor ingresa al menos un miembro o invitado asistente con su nombre y edad, o selecciona "No asistió nadie" / "No realizó".'
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
    const finalTopic =
      reportStatus === 'no_realizo'
        ? 'NO REALIZÓ'
        : reportStatus === 'no_asistio_nadie'
        ? 'NO ASISTIÓ NADIE'
        : reportTopic.trim() || 'El tiempo de la sequía a terminado';

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
      membersCount: reportStatus === 'no_realizo' || reportStatus === 'no_asistio_nadie' ? 0 : validMembers.length,
      membersList: reportStatus === 'no_realizo' || reportStatus === 'no_asistio_nadie' ? [] : validMembers,
      visitorsCount: reportStatus === 'no_realizo' || reportStatus === 'no_asistio_nadie' ? 0 : validVisitors.length,
      visitorsList: reportStatus === 'no_realizo' || reportStatus === 'no_asistio_nadie' ? [] : validVisitors,
      conversionsCount:
        reportStatus === 'no_realizo' || reportStatus === 'no_asistio_nadie'
          ? 0
          : parseInt(reportConversions, 10) || 0,
      topic: finalTopic,
      status: reportStatus,
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

  // Filtrado y Agrupación de Planilla de Células (Formato Excel Pastoral)
  const filteredReportsForSheet = useMemo(() => {
    return myCellReports.filter((r) => {
      if (sheetSearchQuery.trim().length > 0) {
        const q = sheetSearchQuery.toLowerCase();
        const matchLeader = (r.leaderName || '').toLowerCase().includes(q);
        const matchCellLeader = (r.cellLeaderName || '').toLowerCase().includes(q);
        const matchHost = (r.hostName || '').toLowerCase().includes(q);
        const matchAssistant = (r.assistantName || '').toLowerCase().includes(q);
        const matchTopic = (r.topic || '').toLowerCase().includes(q);
        return matchLeader || matchCellLeader || matchHost || matchAssistant || matchTopic;
      }
      return true;
    });
  }, [myCellReports, sheetSearchQuery]);

  // Resuelve el nombre del Líder 12 del reporte para agrupar en la planilla
  const resolveLeader12Name = useCallback(
    (rep: CellMeetingReport): string => {
      // 1. Buscar al miembro que es líder de la célula
      const repCellLeader = (rep.cellLeaderName || '').trim();
      const cleanCellLeader = repCellLeader
        .toLowerCase()
        .replace(/^(líder|lider|pastor|pastora)\s+/i, '')
        .trim();

      const cellLeaderMember = members.find((m) => {
        const full = `${m.firstName} ${m.lastName}`.toLowerCase().trim();
        return (
          full === cleanCellLeader ||
          m.firstName.toLowerCase().trim() === cleanCellLeader ||
          (cleanCellLeader.includes(m.firstName.toLowerCase().trim()) &&
            cleanCellLeader.includes(m.lastName.toLowerCase().trim()))
        );
      });

      if (cellLeaderMember) {
        // Si el líder de célula es pastor, su grupo es su propio nombre pastoral
        if (
          cellLeaderMember.role === 'senior_pastor' ||
          cellLeaderMember.role === 'network_pastor'
        ) {
          const prefix = cellLeaderMember.gender === 'F' ? 'Pastora' : 'Pastor';
          return `${prefix} ${cellLeaderMember.firstName} ${cellLeaderMember.lastName}`.trim();
        }

        const leaderOfMember = cellLeaderMember.leaderId
          ? members.find((m) => m.id === cellLeaderMember.leaderId)
          : undefined;

        // Si el líder de célula es Líder 12 (nivel 2, su líder es pastor de red)
        const isLider12 =
          cellLeaderMember.generationLevel === 2 ||
          cellLeaderMember.isLeaderOf12 ||
          (leaderOfMember &&
            (leaderOfMember.role === 'senior_pastor' ||
              leaderOfMember.role === 'network_pastor'));

        if (isLider12) {
          return `${cellLeaderMember.firstName} ${cellLeaderMember.lastName}`.trim();
        }

        // Si es un 144 (nivel 3), su Líder 12 es su líder directo
        if (leaderOfMember) {
          return `${leaderOfMember.firstName} ${leaderOfMember.lastName}`.trim();
        }
      }

      // 2. Revisar rep.leaderName (nombre de cobertura de la célula)
      const covName = (rep.leaderName || '').trim();
      const cleanCov = covName
        .toLowerCase()
        .replace(/^(líder|lider|pastor|pastora)\s+/i, '')
        .trim();

      const isCovPastor =
        cleanCov.includes('josue') ||
        cleanCov.includes('josué') ||
        cleanCov.includes('norelis');

      if (isCovPastor) {
        // La célula tiene cobertura de un pastor, por ende el que la dirige es el Líder 12
        if (repCellLeader && !cleanCellLeader.includes('pastor') && !isCovPastor) {
          return repCellLeader.replace(/^(líder|lider)\s+/i, '').trim();
        }
      }

      if (covName && !isCovPastor) {
        return covName.replace(/^(líder|lider)\s+/i, '').trim();
      }

      return repCellLeader || 'Sin Cobertura';
    },
    [members]
  );

  const groupedSheetData = useMemo(() => {
    const leaderMap = new Map<string, CellMeetingReport[]>();
    for (const rep of filteredReportsForSheet) {
      const leader = resolveLeader12Name(rep);
      if (!leaderMap.has(leader)) {
        leaderMap.set(leader, []);
      }
      leaderMap.get(leader)!.push(rep);
    }

    const leaderGroups = Array.from(leaderMap.entries()).map(([leaderName, reps], index) => {
      // Ordenar: primero la célula del propio Líder 12, luego las de sus discípulos 144
      const cleanLeader = leaderName.toLowerCase().trim();
      const sortedReps = [...reps].sort((a, b) => {
        const aName = (a.cellLeaderName || '').toLowerCase().trim();
        const bName = (b.cellLeaderName || '').toLowerCase().trim();
        const aIsLeader = aName.includes(cleanLeader) || cleanLeader.includes(aName);
        const bIsLeader = bName.includes(cleanLeader) || cleanLeader.includes(bName);
        if (aIsLeader && !bIsLeader) return -1;
        if (!aIsLeader && bIsLeader) return 1;
        return 0;
      });

      // Calcular subtotales del grupo del Líder 12
      const groupMembers = sortedReps.reduce((sum, r) => sum + (r.membersCount || 0), 0);
      const groupVisitors = sortedReps.reduce((sum, r) => sum + (r.visitorsCount || 0), 0);
      const groupConversions = sortedReps.reduce((sum, r) => sum + (r.conversionsCount || 0), 0);
      const groupVes = sortedReps.reduce((sum, r) => sum + (r.offeringDetails?.vesCash || 0), 0);
      const groupUsd = sortedReps.reduce(
        (sum, r) =>
          sum + (r.offeringDetails?.usdCash || (!r.offeringDetails ? r.offering || 0 : 0)),
        0
      );
      const groupPm = sortedReps.reduce(
        (sum, r) => sum + (r.offeringDetails?.pagoMovilAmount || 0),
        0
      );

      return {
        leaderName,
        leaderIndex: index + 1,
        cellsCount: sortedReps.length,
        reports: sortedReps,
        totals: {
          members: groupMembers,
          visitors: groupVisitors,
          conversions: groupConversions,
          offeringVes: groupVes,
          offeringUsd: groupUsd,
          offeringPm: groupPm,
        },
      };
    });

    const totalCells = filteredReportsForSheet.length;
    const totalMembers = filteredReportsForSheet.reduce((sum, r) => sum + (r.membersCount || 0), 0);
    const totalVisitors = filteredReportsForSheet.reduce((sum, r) => sum + (r.visitorsCount || 0), 0);
    const totalConversions = filteredReportsForSheet.reduce(
      (sum, r) => sum + (r.conversionsCount || 0),
      0
    );
    const totalOfferingVes = filteredReportsForSheet.reduce(
      (sum, r) => sum + (r.offeringDetails?.vesCash || 0),
      0
    );
    const totalOfferingUsd = filteredReportsForSheet.reduce(
      (sum, r) =>
        sum +
        (r.offeringDetails?.usdCash ||
          (!r.offeringDetails ? r.offering || 0 : 0)),
      0
    );
    const totalOfferingPm = filteredReportsForSheet.reduce(
      (sum, r) => sum + (r.offeringDetails?.pagoMovilAmount || 0),
      0
    );

    return {
      leaderGroups,
      totalCells,
      totalMembers,
      totalVisitors,
      totalConversions,
      totalOfferingVes,
      totalOfferingUsd,
      totalOfferingPm,
    };
  }, [filteredReportsForSheet, resolveLeader12Name]);

  // Generador de Hoja de Cálculo HTML con estilos visuales completos idénticos al Excel (Colores, bordes, cabecera verde, recuadro amarillo)
  const generateStyledExcelHTML = () => {
    const netTitle = 'Planilla Consolidada de Células';

    const rowsHtml: string[] = [];

    groupedSheetData.leaderGroups.forEach((group) => {
      group.reports.forEach((rep, rIndex) => {
        const isFirst = rIndex === 0;
        const isNoAsistio =
          rep.status === 'no_asistio_nadie' ||
          (rep.topic && rep.topic.toUpperCase().includes('NO ASISTIÓ'));
        const isNoRealizo =
          rep.status === 'no_realizo' ||
          (rep.topic && rep.topic.toUpperCase().includes('NO REALIZÓ'));

        const vesCash = rep.offeringDetails?.vesCash || 0;
        const usdCash =
          rep.offeringDetails?.usdCash || (!rep.offeringDetails ? rep.offering || 0 : 0);
        const pmCash = rep.offeringDetails?.pagoMovilAmount || 0;

        const rowBg = isNoRealizo ? 'background-color: #FFF7ED;' : '';
        const topicStyle = isNoAsistio
          ? 'color: #DC2626; font-weight: bold;'
          : isNoRealizo
          ? 'color: #EA580C; font-weight: bold;'
          : 'color: #334155;';

        const guestStyle =
          (rep.visitorsCount || 0) > 0
            ? 'background-color: #DCFCE7; color: #15803D; font-weight: bold;'
            : 'background-color: #FEE2E2; color: #DC2626; font-weight: bold;';

        const row = `
          <tr style="${rowBg}">
            <td style="text-align: center; color: #94A3B8; border: 1px solid #CBD5E1; padding: 6px;">${
              isFirst ? group.leaderIndex : ''
            }</td>
            <td style="font-weight: bold; background-color: #F8FAFC; border: 1px solid #CBD5E1; padding: 6px;">${
              isFirst ? group.leaderName : ''
            }</td>
            <td style="text-align: center; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px;">${
              isFirst ? group.cellsCount : ''
            }</td>
            <td style="font-weight: 600; border: 1px solid #CBD5E1; padding: 6px;">${rep.cellLeaderName}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; color: ${
              !rep.assistantName || rep.assistantName === 'No tiene' ? '#94A3B8' : '#0F172A'
            };">${rep.assistantName || 'No tiene'}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px;">${rep.hostName || ''}</td>
            <td style="border: 1px solid #CBD5E1; padding: 6px; ${topicStyle}">${
          rep.topic || rep.notes || 'Sin registrar'
        }</td>
            <td style="text-align: center; color: #64748B; border: 1px solid #CBD5E1; padding: 6px;">${
              rep.date ? rep.date.split('-').reverse().join('/') : ''
            }</td>
            <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px;">${
              rep.membersCount || 0
            }</td>
            <td style="text-align: center; border: 1px solid #CBD5E1; padding: 6px; ${guestStyle}">${
          rep.visitorsCount || 0
        }</td>
            <td style="text-align: center; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px; color: ${
              (rep.conversionsCount || 0) > 0 ? '#7C3AED' : '#0F172A'
            };">${rep.conversionsCount || 0}</td>
            <td style="text-align: right; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px; color: ${
              vesCash > 0 ? '#0F172A' : '#EA580C'
            }; background-color: ${vesCash === 0 ? '#FFEDD5' : 'transparent'};">${
          vesCash > 0 ? `Bs. ${vesCash.toLocaleString()}` : '0'
        }</td>
            <td style="text-align: right; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px; color: ${
              usdCash > 0 ? '#0F172A' : '#EA580C'
            }; background-color: ${usdCash === 0 ? '#FFEDD5' : 'transparent'};">${
          usdCash > 0 ? `$${usdCash.toLocaleString()}` : '0'
        }</td>
            <td style="text-align: right; font-weight: bold; border: 1px solid #CBD5E1; padding: 6px; color: ${
              pmCash > 0 ? '#0F172A' : '#EA580C'
            }; background-color: ${pmCash === 0 ? '#FFEDD5' : 'transparent'};">${
          pmCash > 0 ? `Bs. ${pmCash.toLocaleString()}` : '0'
        }</td>
          </tr>`;
        rowsHtml.push(row);
      });

      if (group.reports.length > 1) {
        const subtotalRow = `
          <tr style="background-color: #F8FAFC; border-top: 1.5px solid #94A3B8; border-bottom: 2px solid #64748B;">
            <td style="border: 1px solid #CBD5E1;"></td>
            <td style="font-weight: 800; color: #1E3A8A; background-color: #EFF6FF; border: 1px solid #CBD5E1; padding: 6px;">Total ${group.leaderName}</td>
            <td style="text-align: center; font-weight: 800; color: #1E3A8A; background-color: #EFF6FF; border: 1px solid #CBD5E1; padding: 6px;">${group.cellsCount} cél</td>
            <td colspan="5" style="border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #64748B; padding: 6px; font-size: 10pt;">Subtotal ${group.leaderName}:</td>
            <td style="text-align: center; font-weight: 800; border: 1px solid #CBD5E1; padding: 6px;">${group.totals.members}</td>
            <td style="text-align: center; font-weight: 800; background-color: #DCFCE7; color: #15803D; border: 1px solid #CBD5E1; padding: 6px;">${group.totals.visitors}</td>
            <td style="text-align: center; font-weight: 800; color: #7C3AED; border: 1px solid #CBD5E1; padding: 6px;">${group.totals.conversions}</td>
            <td style="text-align: right; font-weight: 800; border: 1px solid #CBD5E1; padding: 6px; color: ${group.totals.offeringVes > 0 ? '#0F172A' : '#EA580C'};">${group.totals.offeringVes > 0 ? `Bs. ${group.totals.offeringVes.toLocaleString()}` : '0'}</td>
            <td style="text-align: right; font-weight: 800; border: 1px solid #CBD5E1; padding: 6px; color: ${group.totals.offeringUsd > 0 ? '#0F172A' : '#EA580C'};">${group.totals.offeringUsd > 0 ? `$${group.totals.offeringUsd.toLocaleString()}` : '0'}</td>
            <td style="text-align: right; font-weight: 800; border: 1px solid #CBD5E1; padding: 6px; color: ${group.totals.offeringPm > 0 ? '#0F172A' : '#EA580C'};">${group.totals.offeringPm > 0 ? `Bs. ${group.totals.offeringPm.toLocaleString()}` : '0'}</td>
          </tr>`;
        rowsHtml.push(subtotalRow);
      }
    });

    return `<!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Planilla Celular</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; padding: 12px; }
        .sheet-title { font-size: 18pt; font-weight: 800; color: #15803D; margin-bottom: 2px; }
        .sheet-sub { font-size: 11pt; color: #475569; margin-bottom: 12px; }
        table { border-collapse: collapse; width: 100%; border: 1px solid #94A3B8; font-size: 10.5pt; }
        th { background-color: #15803D; color: #FFFFFF; font-weight: bold; border: 1px solid #047857; padding: 8px 10px; text-align: center; }
        td { border: 1px solid #CBD5E1; padding: 6px 8px; vertical-align: middle; }
        .totals-row td { background-color: #F1F5F9; font-weight: bold; border-top: 2.5px solid #0F172A; }
        .yellow-total { background-color: #FEF08A; color: #854D0E; font-weight: 900; border: 2px solid #CA8A04; text-align: center; font-size: 12pt; }
      </style>
      </head>
      <body>
        <div class="sheet-title">${netTitle}</div>
        <div class="sheet-sub">Iglesia Emmanuel de Caja de Agua • Planilla Semanal de Células</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 140px;">Líder 12</th>
              <th style="width: 80px;">Cant. Células</th>
              <th style="width: 140px;">Líder de Célula</th>
              <th style="width: 130px;">Asistente</th>
              <th style="width: 130px;">Anfitrión (a)</th>
              <th style="width: 190px;">Palabra Predicada</th>
              <th style="width: 85px;">Fecha</th>
              <th style="width: 70px;">Miembros</th>
              <th style="width: 70px;">Invitados</th>
              <th style="width: 75px;">Aceptó Cristo</th>
              <th style="width: 90px;">Ofrenda Bs.</th>
              <th style="width: 80px;">Ofrenda $</th>
              <th style="width: 90px;">Pago Móvil</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.join('')}
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="text-align: center; font-weight: 900; border: 1px solid #CBD5E1;">TOTALES</td>
              <td class="yellow-total">${groupedSheetData.totalCells}</td>
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="border: 1px solid #CBD5E1;"></td>
              <td style="text-align: center; font-weight: bold; border: 1px solid #CBD5E1;">${
                groupedSheetData.totalMembers
              }</td>
              <td style="text-align: center; font-weight: bold; background-color: #DCFCE7; color: #15803D; border: 1px solid #CBD5E1;">${
                groupedSheetData.totalVisitors
              }</td>
              <td style="text-align: center; font-weight: bold; color: #7C3AED; border: 1px solid #CBD5E1;">${
                groupedSheetData.totalConversions
              }</td>
              <td style="text-align: right; font-weight: bold; color: #047857; border: 1px solid #CBD5E1;">${
                groupedSheetData.totalOfferingVes > 0
                  ? `Bs. ${groupedSheetData.totalOfferingVes.toLocaleString()}`
                  : 'Bs. 0'
              }</td>
              <td style="text-align: right; font-weight: bold; color: #047857; border: 1px solid #CBD5E1;">$${groupedSheetData.totalOfferingUsd.toLocaleString()}</td>
              <td style="text-align: right; font-weight: bold; color: #047857; border: 1px solid #CBD5E1;">${
                groupedSheetData.totalOfferingPm > 0
                  ? `Bs. ${groupedSheetData.totalOfferingPm.toLocaleString()}`
                  : 'Bs. 0'
              }</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>`;
  };

  const generateExcelCSV = () => {
    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const header = [
      'N°',
      'Líder 12',
      'Cant. Células',
      'Líder de Célula',
      'Asistente',
      'Anfitrión (a)',
      'Palabra Predicada',
      'Fecha',
      'Miembros',
      'Invitados',
      'Aceptó a Cristo',
      'Ofrenda Bs.',
      'Ofrenda $',
      'Pago Móvil (Bs.)',
    ].join(';');

    const rows: string[] = [];

    groupedSheetData.leaderGroups.forEach((group) => {
      group.reports.forEach((rep, rIndex) => {
        const isFirst = rIndex === 0;
        const vesCash = rep.offeringDetails?.vesCash || 0;
        const usdCash =
          rep.offeringDetails?.usdCash || (!rep.offeringDetails ? rep.offering || 0 : 0);
        const pmCash = rep.offeringDetails?.pagoMovilAmount || 0;

        const row = [
          isFirst ? group.leaderIndex : '',
          escapeCsv(isFirst ? group.leaderName : ''),
          isFirst ? group.cellsCount : '',
          escapeCsv(rep.cellLeaderName || ''),
          escapeCsv(rep.assistantName || 'No tiene'),
          escapeCsv(rep.hostName || ''),
          escapeCsv(rep.topic || rep.notes || 'Sin registrar'),
          escapeCsv(rep.date ? rep.date.split('-').reverse().join('/') : ''),
          rep.membersCount || 0,
          rep.visitorsCount || 0,
          rep.conversionsCount || 0,
          vesCash,
          usdCash,
          pmCash,
        ].join(';');
        rows.push(row);
      });

      if (group.reports.length > 1) {
        const subtotalRow = [
          '',
          escapeCsv(`Total ${group.leaderName}`),
          `${group.cellsCount} cél`,
          '',
          '',
          '',
          escapeCsv(`Subtotal ${group.leaderName}`),
          '',
          group.totals.members,
          group.totals.visitors,
          group.totals.conversions,
          group.totals.offeringVes,
          group.totals.offeringUsd,
          group.totals.offeringPm,
        ].join(';');
        rows.push(subtotalRow);
      }
    });

    const totalsRow = [
      '',
      '"TOTALES"',
      groupedSheetData.totalCells,
      '',
      '',
      '',
      '',
      '',
      groupedSheetData.totalMembers,
      groupedSheetData.totalVisitors,
      groupedSheetData.totalConversions,
      groupedSheetData.totalOfferingVes,
      groupedSheetData.totalOfferingUsd,
      groupedSheetData.totalOfferingPm,
    ].join(';');

    // \uFEFF is UTF-8 Byte Order Mark for Microsoft Excel compatibility
    return `\uFEFF${header}\n${rows.join('\n')}\n${totalsRow}`;
  };

  const handleExportExcel = async () => {
    const htmlExcelContent = generateStyledExcelHTML();
    const filename = `Planilla_Celulas_${new Date().toISOString().slice(0, 10)}.xls`;

    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([htmlExcelContent], {
          type: 'application/vnd.ms-excel;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert(
          'Excel Descargado',
          `Se descargó la planilla en formato Excel (${filename}) con los colores, recuadro amarillo y formato idéntico a la plantilla.`
        );
      } catch (e) {
        console.warn('Error downloading Excel on web:', e);
      }
    } else {
      try {
        await Share.share({
          message: generateExcelCSV(),
          title: 'Planilla de Células (Excel)',
        });
      } catch {
        Alert.alert('Compartir', 'No se pudo abrir el menú de compartir.');
      }
    }
  };

  const handleShareSheetSummary = async () => {
    const text = `📊 *PLANILLA SEMANAL DE CÉLULAS*
🏛️ *Iglesia Emmanuel de Caja de Agua*

Total Células Reportadas: ${groupedSheetData.totalCells}
👥 Miembros Asistentes: ${groupedSheetData.totalMembers}
✨ Invitados Nuevos: ${groupedSheetData.totalVisitors}
✝️ Aceptó a Cristo / Decisiones: ${groupedSheetData.totalConversions}
💵 Ofrenda Efectivo $: $${groupedSheetData.totalOfferingUsd.toLocaleString()}
🇻🇪 Ofrenda Efectivo Bs.: Bs. ${groupedSheetData.totalOfferingVes.toLocaleString()}
📲 Ofrenda Pago Móvil: Bs. ${groupedSheetData.totalOfferingPm.toLocaleString()}

📋 *Líderes 12 y Células:*
${groupedSheetData.leaderGroups
  .map(
    (g) =>
      `• *${g.leaderName}* (${g.cellsCount} cél): ${g.reports
        .map((r) => {
          const usd = r.offeringDetails?.usdCash || (!r.offeringDetails ? r.offering || 0 : 0);
          const ves = r.offeringDetails?.vesCash || 0;
          const pm = r.offeringDetails?.pagoMovilAmount || 0;
          const offParts = [];
          if (usd > 0) offParts.push(`$${usd}`);
          if (ves > 0) offParts.push(`Bs.${ves}`);
          if (pm > 0) offParts.push(`PM:${pm}`);
          const offStr = offParts.length > 0 ? ` | Ofrenda: ${offParts.join(', ')}` : '';
          return `${r.cellLeaderName} [${r.membersCount}M / ${r.visitorsCount}I / ${
            r.conversionsCount || 0
          }A${offStr}]`;
        })
        .join(', ')}`
  )
  .join('\n')}`;

    try {
      await Share.share({
        message: text,
        title: 'Planilla de Células',
      });
    } catch {
      Alert.alert('Compartir', 'No se pudo abrir el menú de compartir.');
    }
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar style="light" />
      <DoodleBackground>

      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <Ionicons name="git-network" size={14} color="#2563EB" />
            <Text style={styles.badgeText}>Discipulado G12</Text>
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

            {/* List of Cells: Su propia célula primero, luego las de sus discípulos */}
            {[...cellGroups]
              .sort((a, b) => {
                const cleanUser = myFullName.trim().toLowerCase().replace(/^(pastor|pastora|líder)\s+/i, '');
                const aClean = a.cellLeaderName.trim().toLowerCase().replace(/^(pastor|pastora|líder)\s+/i, '');
                const bClean = b.cellLeaderName.trim().toLowerCase().replace(/^(pastor|pastora|líder)\s+/i, '');
                const aMine = aClean === cleanUser || aClean.includes(cleanUser);
                const bMine = bClean === cleanUser || bClean.includes(cleanUser);
                if (aMine && !bMine) return -1;
                if (!aMine && bMine) return 1;
                return 0;
              })
              .map((cell) => {
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
                {currentUser?.role === 'senior_pastor'
                  ? 'Bandeja Pastoral: Mostrando reportes recibidos de las células y discípulos.'
                  : `Tus reportes son enviados directamente a tu pastor/líder encargado: ${leaderInCharge.name}.`}
              </Text>
            </View>

            {/* View Mode Toggle: Planilla Consolidada vs Fichas Detalladas */}
            <View style={styles.viewModeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  reportsViewMode === 'sheet' && styles.viewModeBtnActiveGreen,
                ]}
                onPress={() => setReportsViewMode('sheet')}
                activeOpacity={0.8}>
                <Ionicons
                  name="grid"
                  size={15}
                  color={reportsViewMode === 'sheet' ? '#FFFFFF' : '#15803D'}
                />
                <Text
                  style={[
                    styles.viewModeBtnText,
                    reportsViewMode === 'sheet' && styles.viewModeBtnTextActive,
                  ]}>
                  Planilla Excel (Consolidado)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  reportsViewMode === 'cards' && styles.viewModeBtnActiveBlue,
                ]}
                onPress={() => setReportsViewMode('cards')}
                activeOpacity={0.8}>
                <Ionicons
                  name="albums-outline"
                  size={15}
                  color={reportsViewMode === 'cards' ? '#FFFFFF' : '#2563EB'}
                />
                <Text
                  style={[
                    styles.viewModeBtnText,
                    reportsViewMode === 'cards' && styles.viewModeBtnTextActive,
                  ]}>
                  Fichas Individuales
                </Text>
              </TouchableOpacity>
            </View>

            {reportsViewMode === 'sheet' ? (
              <View>
                {/* Control Panel: Header, Redes y Buscador */}
                <View style={styles.sheetControlsCard}>
                  <View style={styles.sheetHeaderBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetHeaderTitle}>
                        Planilla Consolidada de Células
                      </Text>
                      <Text style={styles.sheetHeaderSubtitle}>
                        {groupedSheetData.totalCells} Células • {groupedSheetData.leaderGroups.length} Líderes de 12
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.sheetShareBtn, { backgroundColor: '#15803D' }]}
                        onPress={handleExportExcel}
                        activeOpacity={0.8}>
                        <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.sheetShareBtnText}>Descargar Excel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.sheetShareBtn, { backgroundColor: '#2563EB' }]}
                        onPress={handleShareSheetSummary}
                        activeOpacity={0.8}>
                        <Ionicons name="share-social-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.sheetShareBtnText}>Compartir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>



                  {/* Buscador dentro de la planilla */}
                  <View style={styles.sheetSearchBox}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                      style={styles.sheetSearchInput}
                      placeholder="Buscar por líder 12, célula, anfitrión o palabra..."
                      placeholderTextColor="#94A3B8"
                      value={sheetSearchQuery}
                      onChangeText={setSheetSearchQuery}
                    />
                    {sheetSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSheetSearchQuery('')}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Tabla Planilla estilo Excel */}
                {filteredReportsForSheet.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="receipt-outline" size={38} color="#D97706" />
                    </View>
                    <Text style={styles.emptyTitle}>Sin reportes en esta selección</Text>
                    <Text style={styles.emptySubtitle}>
                      No se encontraron reportes celulares para los filtros o búsqueda especificada.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.sheetTableWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                      <View style={styles.sheetTable}>
                        {/* Table Header Row */}
                        <View style={styles.tableHeaderRow}>
                          <View style={[styles.thCell, { width: 38 }]}>
                            <Text style={styles.thText}>#</Text>
                          </View>
                          <View style={[styles.thCell, { width: 135 }]}>
                            <Text style={styles.thText}>Líder 12</Text>
                          </View>
                          <View style={[styles.thCell, { width: 75 }]}>
                            <Text style={styles.thText}>Cant. Células</Text>
                          </View>
                          <View style={[styles.thCell, { width: 140 }]}>
                            <Text style={styles.thText}>Líder de Célula</Text>
                          </View>
                          <View style={[styles.thCell, { width: 130 }]}>
                            <Text style={styles.thText}>Asistente</Text>
                          </View>
                          <View style={[styles.thCell, { width: 130 }]}>
                            <Text style={styles.thText}>Anfitrión (a)</Text>
                          </View>
                          <View style={[styles.thCell, { width: 180 }]}>
                            <Text style={styles.thText}>Palabra Predicada</Text>
                          </View>
                          <View style={[styles.thCell, { width: 85 }]}>
                            <Text style={styles.thText}>Fecha</Text>
                          </View>
                          <View style={[styles.thCell, { width: 70 }]}>
                            <Text style={styles.thText}>Miembros</Text>
                          </View>
                          <View style={[styles.thCell, { width: 70 }]}>
                            <Text style={styles.thText}>Invitados</Text>
                          </View>
                          <View style={[styles.thCell, { width: 75 }]}>
                            <Text style={styles.thText}>Aceptó Cristo</Text>
                          </View>
                          <View style={[styles.thCell, { width: 85 }]}>
                            <Text style={styles.thText}>Ofrenda Bs.</Text>
                          </View>
                          <View style={[styles.thCell, { width: 75 }]}>
                            <Text style={styles.thText}>Ofrenda $</Text>
                          </View>
                          <View style={[styles.thCell, { width: 85 }]}>
                            <Text style={styles.thText}>Pago Móvil</Text>
                          </View>
                        </View>

                        {/* Table Body: Grouped by Líder 12 */}
                        {groupedSheetData.leaderGroups.map((group) => {
                          return (
                            <Fragment key={group.leaderName}>
                              {group.reports.map((rep, rIndex) => {
                                const isFirstOfLeader = rIndex === 0;
                                const isNoAsistio =
                                  rep.status === 'no_asistio_nadie' ||
                                  (rep.topic && rep.topic.toUpperCase().includes('NO ASISTIÓ'));
                                const isNoRealizo =
                                  rep.status === 'no_realizo' ||
                                  (rep.topic && rep.topic.toUpperCase().includes('NO REALIZÓ'));

                                return (
                                  <View
                                    key={rep.id}
                                    style={[
                                      styles.tableDataRow,
                                      isNoRealizo && styles.rowNoRealizo,
                                    ]}>
                                    {/* Columna #: Número del líder */}
                                    <View style={[styles.tdCell, { width: 38 }]}>
                                      <Text style={styles.tdTextMuted}>
                                        {isFirstOfLeader ? group.leaderIndex : ''}
                                      </Text>
                                    </View>

                                    {/* Columna Líder 12 */}
                                    <View
                                      style={[
                                        styles.tdCell,
                                        { width: 135 },
                                        isFirstOfLeader && styles.leaderCellGrouped,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.tdTextBold,
                                          !isFirstOfLeader && { color: '#94A3B8', fontSize: 11 },
                                        ]}
                                        numberOfLines={1}>
                                        {isFirstOfLeader ? group.leaderName : ''}
                                      </Text>
                                    </View>

                                    {/* Columna Cant. de Células */}
                                    <View style={[styles.tdCell, { width: 75, alignItems: 'center' }]}>
                                      <Text style={styles.tdTextCenterBold}>
                                        {isFirstOfLeader ? group.cellsCount : ''}
                                      </Text>
                                    </View>

                                    {/* Líder de Célula */}
                                    <View style={[styles.tdCell, { width: 140 }]}>
                                      <Text style={styles.tdText} numberOfLines={1}>
                                        {rep.cellLeaderName}
                                      </Text>
                                    </View>

                                    {/* Asistente */}
                                    <View style={[styles.tdCell, { width: 130 }]}>
                                      <Text
                                        style={[
                                          styles.tdText,
                                          (!rep.assistantName ||
                                            rep.assistantName.toLowerCase() === 'no tiene') &&
                                            styles.tdTextMuted,
                                        ]}
                                        numberOfLines={1}>
                                        {rep.assistantName || 'No tiene'}
                                      </Text>
                                    </View>

                                    {/* Anfitrión (a) */}
                                    <View style={[styles.tdCell, { width: 130 }]}>
                                      <Text style={styles.tdText} numberOfLines={1}>
                                        {rep.hostName}
                                      </Text>
                                    </View>

                                    {/* Palabra Predicada */}
                                    <View style={[styles.tdCell, { width: 180 }]}>
                                      <Text
                                        style={[
                                          styles.tdText,
                                          isNoAsistio && styles.tdTextDanger,
                                          isNoRealizo && styles.tdTextWarning,
                                        ]}
                                        numberOfLines={1}>
                                        {rep.topic || rep.notes || 'Sin registrar'}
                                      </Text>
                                    </View>

                                    {/* Fecha */}
                                    <View style={[styles.tdCell, { width: 85, alignItems: 'center' }]}>
                                      <Text style={styles.tdTextCenterMuted}>
                                        {rep.date ? rep.date.split('-').reverse().join('/') : ''}
                                      </Text>
                                    </View>

                                    {/* Miembros */}
                                    <View style={[styles.tdCell, { width: 70, alignItems: 'center' }]}>
                                      <Text style={styles.tdTextCenter}>{rep.membersCount}</Text>
                                    </View>

                                    {/* Invitados (Verde si > 0, Rojo si 0) */}
                                    <View
                                      style={[
                                        styles.tdCell,
                                        { width: 70, alignItems: 'center' },
                                        rep.visitorsCount > 0 ? styles.cellGreen : styles.cellRed,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.tdTextCenterBold,
                                          rep.visitorsCount > 0 ? styles.textGreen : styles.textRed,
                                        ]}>
                                        {rep.visitorsCount}
                                      </Text>
                                    </View>

                                    {/* Aceptó a Cristo */}
                                    <View style={[styles.tdCell, { width: 75, alignItems: 'center' }]}>
                                      <Text
                                        style={[
                                          styles.tdTextCenterBold,
                                          (rep.conversionsCount || 0) > 0 && { color: '#7C3AED' },
                                        ]}>
                                        {rep.conversionsCount || 0}
                                      </Text>
                                    </View>

                                    {/* Ofrenda Bs. */}
                                    <View
                                      style={[
                                        styles.tdCell,
                                        { width: 85, alignItems: 'flex-end', paddingRight: 8 },
                                        ((rep.offeringDetails?.vesCash || 0) === 0 || isNoRealizo) && styles.cellOrange,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.tdTextBold,
                                          (rep.offeringDetails?.vesCash || 0) === 0 || isNoRealizo
                                            ? styles.textOrange
                                            : { color: '#0F172A' },
                                        ]}>
                                        {rep.offeringDetails?.vesCash
                                          ? `Bs. ${rep.offeringDetails.vesCash.toLocaleString()}`
                                          : '0'}
                                      </Text>
                                    </View>

                                    {/* Ofrenda $ */}
                                    <View
                                      style={[
                                        styles.tdCell,
                                        { width: 75, alignItems: 'flex-end', paddingRight: 8 },
                                        ((rep.offeringDetails?.usdCash || (!rep.offeringDetails ? rep.offering || 0 : 0)) === 0 || isNoRealizo) && styles.cellOrange,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.tdTextBold,
                                          (rep.offeringDetails?.usdCash || (!rep.offeringDetails ? rep.offering || 0 : 0)) === 0 || isNoRealizo
                                            ? styles.textOrange
                                            : { color: '#0F172A' },
                                        ]}>
                                        {(() => {
                                          const usdVal =
                                            rep.offeringDetails?.usdCash || (!rep.offeringDetails ? rep.offering || 0 : 0);
                                          return usdVal > 0 ? `$${usdVal.toLocaleString()}` : '0';
                                        })()}
                                      </Text>
                                    </View>

                                    {/* Pago Móvil */}
                                    <View
                                      style={[
                                        styles.tdCell,
                                        { width: 85, alignItems: 'flex-end', paddingRight: 8 },
                                        ((rep.offeringDetails?.pagoMovilAmount || 0) === 0 || isNoRealizo) && styles.cellOrange,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.tdTextBold,
                                          (rep.offeringDetails?.pagoMovilAmount || 0) === 0 || isNoRealizo
                                            ? styles.textOrange
                                            : { color: '#0F172A' },
                                        ]}>
                                        {rep.offeringDetails?.pagoMovilAmount
                                          ? `Bs. ${rep.offeringDetails.pagoMovilAmount.toLocaleString()}`
                                          : '0'}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })}

                              {/* Fila de Subtotal del Líder 12 si tiene más de 1 célula o discípulos */}
                              {group.reports.length > 1 && (
                                <View style={styles.tableGroupSubtotalRow}>
                                  <View style={[styles.tdCell, { width: 38 }]} />
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 135, backgroundColor: '#EFF6FF' },
                                    ]}>
                                    <Text
                                      style={[styles.tdTextBold, { color: '#1E3A8A' }]}
                                      numberOfLines={1}>
                                      Total {group.leaderName}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 75, alignItems: 'center', backgroundColor: '#EFF6FF' },
                                    ]}>
                                    <Text style={[styles.tdTextCenterBold, { color: '#1E3A8A' }]}>
                                      {group.cellsCount} cél
                                    </Text>
                                  </View>
                                  <View style={[styles.tdCell, { width: 140 }]} />
                                  <View style={[styles.tdCell, { width: 130 }]} />
                                  <View style={[styles.tdCell, { width: 130 }]} />
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 180, justifyContent: 'center', paddingRight: 8 },
                                    ]}>
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        fontWeight: '700',
                                        color: '#64748B',
                                        textAlign: 'right',
                                      }}>
                                      Subtotal {group.leaderName}:
                                    </Text>
                                  </View>
                                  <View style={[styles.tdCell, { width: 85 }]} />

                                  {/* Total Miembros del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 70, alignItems: 'center', backgroundColor: '#F8FAFC' },
                                    ]}>
                                    <Text style={styles.tdTextCenterBold}>
                                      {group.totals.members}
                                    </Text>
                                  </View>

                                  {/* Total Invitados del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 70, alignItems: 'center', backgroundColor: '#DCFCE7' },
                                    ]}>
                                    <Text
                                      style={[styles.tdTextCenterBold, { color: '#15803D' }]}>
                                      {group.totals.visitors}
                                    </Text>
                                  </View>

                                  {/* Total Conversiones del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      { width: 75, alignItems: 'center', backgroundColor: '#F3E8FF' },
                                    ]}>
                                    <Text
                                      style={[styles.tdTextCenterBold, { color: '#7C3AED' }]}>
                                      {group.totals.conversions}
                                    </Text>
                                  </View>

                                  {/* Total Ofrenda Bs. del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      {
                                        width: 85,
                                        alignItems: 'flex-end',
                                        paddingRight: 8,
                                        backgroundColor: '#F8FAFC',
                                      },
                                    ]}>
                                    <Text style={[styles.tdTextBold, { color: '#0F172A' }]}>
                                      {group.totals.offeringVes > 0
                                        ? `Bs. ${group.totals.offeringVes.toLocaleString()}`
                                        : '0'}
                                    </Text>
                                  </View>

                                  {/* Total Ofrenda $ del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      {
                                        width: 75,
                                        alignItems: 'flex-end',
                                        paddingRight: 8,
                                        backgroundColor: '#F8FAFC',
                                      },
                                    ]}>
                                    <Text style={[styles.tdTextBold, { color: '#0F172A' }]}>
                                      {group.totals.offeringUsd > 0
                                        ? `$${group.totals.offeringUsd.toLocaleString()}`
                                        : '0'}
                                    </Text>
                                  </View>

                                  {/* Total Pago Móvil del Grupo */}
                                  <View
                                    style={[
                                      styles.tdCell,
                                      {
                                        width: 85,
                                        alignItems: 'flex-end',
                                        paddingRight: 8,
                                        backgroundColor: '#F8FAFC',
                                      },
                                    ]}>
                                    <Text style={[styles.tdTextBold, { color: '#0F172A' }]}>
                                      {group.totals.offeringPm > 0
                                        ? `Bs. ${group.totals.offeringPm.toLocaleString()}`
                                        : '0'}
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </Fragment>
                          );
                        })}

                        {/* Fila de Totales (Exacta a la fila 54 del Excel) */}
                        <View style={styles.tableTotalsRow}>
                          <View style={[styles.tdCell, { width: 38 }]} />
                          <View style={[styles.tdCell, { width: 135, alignItems: 'center' }]}>
                            <Text style={styles.totalsLabel}>TOTALES</Text>
                          </View>
                          {/* Total Células: Recuadro Amarillo */}
                          <View
                            style={[
                              styles.tdCell,
                              styles.totalYellowCell,
                              { width: 75, alignItems: 'center' },
                            ]}>
                            <Text style={styles.totalYellowText}>
                              {groupedSheetData.totalCells}
                            </Text>
                          </View>
                          <View style={[styles.tdCell, { width: 140 }]} />
                          <View style={[styles.tdCell, { width: 130 }]} />
                          <View style={[styles.tdCell, { width: 130 }]} />
                          <View style={[styles.tdCell, { width: 180 }]} />
                          <View style={[styles.tdCell, { width: 85 }]} />

                          {/* Total Miembros */}
                          <View style={[styles.tdCell, { width: 70, alignItems: 'center' }]}>
                            <Text style={styles.totalsNum}>{groupedSheetData.totalMembers}</Text>
                          </View>

                          {/* Total Invitados */}
                          <View style={[styles.tdCell, { width: 70, alignItems: 'center' }]}>
                            <Text style={styles.totalsNum}>{groupedSheetData.totalVisitors}</Text>
                          </View>

                          {/* Total Aceptó a Cristo */}
                          <View style={[styles.tdCell, { width: 75, alignItems: 'center' }]}>
                            <Text style={[styles.totalsNum, { color: '#7C3AED' }]}>
                              {groupedSheetData.totalConversions}
                            </Text>
                          </View>

                          {/* Total Ofrenda Bs. */}
                          <View
                            style={[
                              styles.tdCell,
                              { width: 85, alignItems: 'flex-end', paddingRight: 8 },
                            ]}>
                            <Text style={[styles.totalsNum, { color: '#047857' }]}>
                              {groupedSheetData.totalOfferingVes > 0
                                ? `Bs. ${groupedSheetData.totalOfferingVes.toLocaleString()}`
                                : 'Bs. 0'}
                            </Text>
                          </View>

                          {/* Total Ofrenda $ */}
                          <View
                            style={[
                              styles.tdCell,
                              { width: 75, alignItems: 'flex-end', paddingRight: 8 },
                            ]}>
                            <Text style={[styles.totalsNum, { color: '#047857' }]}>
                              {`$${groupedSheetData.totalOfferingUsd.toLocaleString()}`}
                            </Text>
                          </View>

                          {/* Total Pago Móvil */}
                          <View
                            style={[
                              styles.tdCell,
                              { width: 85, alignItems: 'flex-end', paddingRight: 8 },
                            ]}>
                            <Text style={[styles.totalsNum, { color: '#047857' }]}>
                              {groupedSheetData.totalOfferingPm > 0
                                ? `Bs. ${groupedSheetData.totalOfferingPm.toLocaleString()}`
                                : 'Bs. 0'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : myCellReports.length === 0 ? (
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
                      {(currentUser?.id === rep.recipientLeaderId || currentUser?.role === 'senior_pastor') && (
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
                  </View>
                </View>
              )}

              {/* Destinatario del Reporte */}
              <View style={styles.recipientBanner}>
                <Ionicons name="paper-plane" size={16} color="#2563EB" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.recipientBannerTitle}>Líder Encargado (Recibe este Reporte):</Text>
                  <Text style={styles.recipientBannerName}>
                    {leaderInCharge.name} (Cobertura Pastoral)
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

              {/* Estado de la Célula */}
              <Text style={styles.inputLabel}>Estado de la Célula</Text>
              <View style={styles.statusOptionRow}>
                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    reportStatus === 'realizada' && styles.statusOptionBtnActiveGreen,
                  ]}
                  onPress={() => setReportStatus('realizada')}>
                  <Text
                    style={[
                      styles.statusOptionText,
                      reportStatus === 'realizada' && styles.statusOptionTextActive,
                    ]}>
                    ✅ Realizada
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    reportStatus === 'no_asistio_nadie' && styles.statusOptionBtnActiveRed,
                  ]}
                  onPress={() => {
                    setReportStatus('no_asistio_nadie');
                    setReportTopic('NO ASISTIÓ NADIE');
                  }}>
                  <Text
                    style={[
                      styles.statusOptionText,
                      reportStatus === 'no_asistio_nadie' && styles.statusOptionTextActive,
                    ]}>
                    ⚠️ No asistió nadie
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    reportStatus === 'no_realizo' && styles.statusOptionBtnActiveOrange,
                  ]}
                  onPress={() => {
                    setReportStatus('no_realizo');
                    setReportTopic('NO REALIZÓ');
                  }}>
                  <Text
                    style={[
                      styles.statusOptionText,
                      reportStatus === 'no_realizo' && styles.statusOptionTextActive,
                    ]}>
                    ⛔ No realizó
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Palabra Predicada (Tema) */}
              {reportStatus === 'realizada' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Palabra Predicada (Tema semanal) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={reportTopic}
                    onChangeText={setReportTopic}
                    placeholder="Ej: El tiempo de la sequía a terminado"
                    placeholderTextColor="#94A3B8"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {[
                      'El tiempo de la sequía a terminado',
                      'Hoy es día de buenas nuevas',
                      'Nuevo Linaje',
                      'Un camino hacia la bendición',
                    ].map((tema) => (
                      <TouchableOpacity
                        key={tema}
                        style={styles.topicChip}
                        onPress={() => setReportTopic(tema)}>
                        <Text style={styles.topicChipText}>+ {tema}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Aceptó a Cristo / Decisiones */}
              {reportStatus === 'realizada' && (
                <View style={styles.conversionsBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conversionsTitle}>✝️ Aceptó a Cristo / Nuevas Decisiones</Text>
                    <Text style={styles.miniHint}>
                      Personas que recibieron o reconciliaron con Jesús:
                    </Text>
                  </View>
                  <View style={styles.conversionsCounterRow}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => {
                        const current = parseInt(reportConversions, 10) || 0;
                        if (current > 0) setReportConversions(String(current - 1));
                      }}>
                      <Ionicons name="remove" size={16} color="#475569" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.counterInput}
                      keyboardType="numeric"
                      value={reportConversions}
                      onChangeText={setReportConversions}
                    />
                    <TouchableOpacity
                      style={[styles.counterBtn, { backgroundColor: '#7C3AED' }]}
                      onPress={() => {
                        const current = parseInt(reportConversions, 10) || 0;
                        setReportConversions(String(current + 1));
                      }}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

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
    backgroundColor: '#080C16',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  addButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  explanationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  explanationText: {
    fontSize: 12,
    color: '#93C5FD',
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
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
    color: '#FFFFFF',
  },
  cellLeaderRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 2,
  },
  cellCoverageText: {
    fontSize: 11,
    color: '#94A3B8',
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
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  cellNotes: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  cellNotesText: {
    fontSize: 11,
    color: '#94A3B8',
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  membersCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  reportCellBtn: {
    backgroundColor: '#0284C7',
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  offeringSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  offeringBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offeringBadgeItem: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  offeringBadgeLbl: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '600',
  },
  offeringBadgeVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
  },
  offeringAttendanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  offeringAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offeringAttendanceText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  // Reports Tab Styles
  reportCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
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
    color: '#FFFFFF',
  },
  reportDateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  recapTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recapTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
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
    color: '#94A3B8',
  },
  recapVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  peopleSectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#38BDF8',
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
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  personChipName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personChipAge: {
    fontSize: 10,
    color: '#38BDF8',
  },
  peopleCountFallback: {
    fontSize: 11,
    color: '#94A3B8',
  },
  offeringBreakdownCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  offeringBreakdownHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 4,
  },
  offeringItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  offeringItemPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offeringItemText: {
    fontSize: 11,
    color: '#34D399',
  },
  reportNotesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  reportNotesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  reportNotesText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  // Modal Common Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalScroll: {
    marginTop: 14,
  },
  leaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  leaderPillTitle: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  leaderPillName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  networkLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#F1F5F9',
    marginTop: 10,
    marginBottom: 4,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 8,
    marginBottom: 3,
  },
  leaderTypeToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    backgroundColor: '#0284C7',
  },
  leaderTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  leaderTypeTextActive: {
    color: '#FFFFFF',
  },
  miniHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  discipleChipsRow: {
    marginBottom: 8,
  },
  discipleChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  discipleChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  discipleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  discipleChipTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  dayScroll: {
    marginBottom: 6,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
  },
  dayPillActive: {
    backgroundColor: '#0284C7',
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  modalSubmitButton: {
    marginTop: 20,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  // Form Sections inside Report Modal
  formSectionContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#38BDF8',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#0284C7',
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
    color: '#94A3B8',
    marginBottom: 4,
    fontWeight: '600',
  },
  suggestionChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  suggestionChipText: {
    fontSize: 11,
    color: '#38BDF8',
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  personIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
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
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  addFirstVisitorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C084FC',
  },
  // Report Modal Specific Styles
  reportCellDetailsCard: {
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  reportCellTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  reportCellMetaRow: {
    gap: 2,
  },
  reportCellMetaText: {
    fontSize: 12,
    color: '#93C5FD',
  },
  moneyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
    marginRight: 6,
  },
  moneyInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pagoMovilBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pmMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 3,
  },
  recipientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  recipientBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recipientBannerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  inboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  inboxBannerText: {
    fontSize: 12,
    color: '#93C5FD',
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
    color: '#38BDF8',
  },
  receivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  receivedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },

  // View Mode Switcher
  viewModeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewModeBtnActiveGreen: {
    backgroundColor: '#15803D',
    borderColor: '#22C55E',
  },
  viewModeBtnActiveBlue: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  viewModeBtnTextActive: {
    color: '#FFFFFF',
  },

  // Sheet Controls Card
  sheetControlsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  sheetHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetHeaderSubtitle: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '700',
    marginTop: 2,
  },
  sheetShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#15803D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sheetShareBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetNetworkRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  sheetNetworkChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetNetworkChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  sheetNetworkChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sheetNetworkChipTextActive: {
    color: '#FFFFFF',
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    padding: 0,
  },

  // Spreadsheet Table
  sheetTableWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  sheetTable: {
    flexDirection: 'column',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#15803D',
    borderBottomWidth: 1.5,
    borderBottomColor: '#047857',
  },
  thCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0F172A',
    minHeight: 30,
  },
  rowNoRealizo: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
  },
  tdCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
  },
  tdText: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  tdTextBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tdTextMuted: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  tdTextCenter: {
    fontSize: 11,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  tdTextCenterBold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tdTextCenterMuted: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  tdTextDanger: {
    color: '#EF4444',
    fontWeight: '800',
  },
  tdTextWarning: {
    color: '#F97316',
    fontWeight: '800',
  },
  leaderCellGrouped: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  cellGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  textGreen: {
    color: '#34D399',
  },
  cellRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  textRed: {
    color: '#F87171',
  },
  cellOrange: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  textOrange: {
    color: '#FB923C',
  },

  // Group Subtotal Row (Total Líder 12 y discípulos)
  tableGroupSubtotalRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 30,
  },

  // Totals Row (Matching Excel row 54)
  tableTotalsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 32,
  },
  totalsLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  totalsNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  totalYellowCell: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(234, 179, 8, 0.4)',
  },
  totalYellowText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FACC15',
    textAlign: 'center',
  },

  // Modal Status and Topic Selector
  statusOptionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  statusOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionBtnActiveGreen: {
    backgroundColor: '#15803D',
    borderColor: '#22C55E',
  },
  statusOptionBtnActiveRed: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444',
  },
  statusOptionBtnActiveOrange: {
    backgroundColor: '#EA580C',
    borderColor: '#F97316',
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  topicChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginRight: 6,
  },
  topicChipText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  conversionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    padding: 10,
    marginBottom: 12,
  },
  conversionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C084FC',
  },
  conversionsCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 2,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  counterInput: {
    width: 32,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    padding: 0,
  },
});
