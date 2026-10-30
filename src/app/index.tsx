import { AuroraBackground } from '@/components/aurora-background';
import { useChurch } from '@/context/ChurchContext';
import { fetchBibleVerse, POPULAR_VERSES, QuickBibleVerse } from '@/lib/bible';
import {
  EVENT_TYPE_META,
  formatEventDate,
  normalizeEventType,
  sortEventsAsc,
  todayISO,
} from '@/lib/events';
import { PrayerCategory } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './login';
import RegisterScreen from './register';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    currentUser,
    isLoading,
    members,
    ministries,
    getVisibleEvents,
    logout,
    pastoralPosts,
    addPastoralPost,
    toggleLikePost,
    deletePastoralPost,
    prayerRequests,
    addPrayerRequest,
    updatePrayerRequestStatus,
    togglePrayerSupport,
    deletePrayerRequest,
  } = useChurch();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mainTab, setMainTab] = useState<'discipulado' | 'interactiva'>('discipulado');

  // Modal para escribir nuevo mensaje pastoral
  const [modalVisible, setModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postNetwork, setPostNetwork] = useState<'general' | 'adulta' | 'juvenil'>('general');

  // Modales adicionales de cuidado pastoral
  const [birthdayModalVisible, setBirthdayModalVisible] = useState(false);
  const [prayerModalVisible, setPrayerModalVisible] = useState(false);
  const [birthdayFilterTab, setBirthdayFilterTab] = useState<'month' | 'next30' | 'all'>('month');

  // Estado para Peticiones de Oración
  const [prayerTab, setPrayerTab] = useState<'list' | 'create'>('list');
  const [prayerFilter, setPrayerFilter] = useState<'all' | 'pending' | 'praying' | 'answered'>('all');
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerDesc, setPrayerDesc] = useState('');
  const [prayerCategory, setPrayerCategory] = useState<PrayerCategory>('salud');
  const [prayerPhone, setPrayerPhone] = useState('');
  const [prayerPrivate, setPrayerPrivate] = useState(false);
  const [isSubmittingPrayer, setIsSubmittingPrayer] = useState(false);

  // Estado del versículo bíblico adjunto
  const [verseQuery, setVerseQuery] = useState('');
  const [isSearchingVerse, setIsSearchingVerse] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<{
    reference: string;
    text: string;
    translation: string;
  } | null>(null);
  const [verseFeedback, setVerseFeedback] = useState<string | null>(null);

  const isPastor = currentUser?.role === 'senior_pastor';

  const handleOpenCreatePost = () => {
    setPostNetwork('general');
    setModalVisible(true);
  };

  // Próximo evento de la iglesia
  const visibleEvents = useMemo(() => {
    return getVisibleEvents(currentUser);
  }, [getVisibleEvents, currentUser]);

  const today = todayISO();
  const nextEvent = useMemo(() => {
    const sorted = sortEventsAsc(visibleEvents);
    return sorted.find((e) => e.date >= today) || null;
  }, [visibleEvents, today]);

  // Mensajes pastorales para toda la iglesia
  const visiblePosts = useMemo(() => {
    if (!currentUser) return [];
    return pastoralPosts;
  }, [pastoralPosts, currentUser]);

  // Cumpleañeros calculados con data de perfiles y fecha de nacimiento
  const birthdaysList = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const curDay = now.getDate();

    return members
      .filter((m) => Boolean(m.birthDate))
      .map((m) => {
        const parts = m.birthDate!.replace(/\//g, '-').split('-');
        const bYear = parts.length >= 1 ? parseInt(parts[0], 10) : 0;
        const bMonth = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
        const bDay = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
        const isToday = bMonth === curMonth && bDay === curDay;

        let nextBDate = new Date(curYear, bMonth - 1, bDay);
        if (nextBDate.getTime() < new Date(curYear, curMonth - 1, curDay).getTime()) {
          nextBDate = new Date(curYear + 1, bMonth - 1, bDay);
        }
        const diffMs = nextBDate.getTime() - new Date(curYear, curMonth - 1, curDay).getTime();
        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const ageTurning = bYear > 1900 ? (nextBDate.getFullYear() - bYear) : null;

        return {
          member: m,
          day: bDay,
          month: bMonth,
          year: bYear,
          isToday,
          isCurrentMonth: bMonth === curMonth,
          daysUntil,
          ageTurning,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [members]);

  const filteredBirthdays = useMemo(() => {
    if (birthdayFilterTab === 'month') {
      return birthdaysList.filter((b) => b.isCurrentMonth);
    }
    if (birthdayFilterTab === 'next30') {
      return birthdaysList.filter((b) => b.daysUntil <= 30);
    }
    return birthdaysList;
  }, [birthdaysList, birthdayFilterTab]);

  const birthdaysThisMonthCount = useMemo(() => {
    return birthdaysList.filter((b) => b.isCurrentMonth).length;
  }, [birthdaysList]);

  // Peticiones de Oración y conteo para pastores
  const pendingPrayersCount = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'pending').length;
  }, [prayerRequests]);

  const visiblePrayerRequests = useMemo(() => {
    let list = prayerRequests;
    if (!isPastor) {
      list = prayerRequests.filter(
        (p) => p.memberId === currentUser?.id || (!p.isPrivateForPastors)
      );
    }
    if (prayerFilter !== 'all') {
      list = list.filter((p) => p.status === prayerFilter);
    }
    return list;
  }, [prayerRequests, isPastor, currentUser, prayerFilter]);

  const latestPrayer = useMemo(() => {
    return visiblePrayerRequests.length > 0 ? visiblePrayerRequests[0] : null;
  }, [visiblePrayerRequests]);

  const handleSendPrayerRequest = async () => {
    if (!prayerTitle.trim()) {
      Alert.alert('Falta el motivo', 'Por favor ingresa el título o motivo de la petición.');
      return;
    }
    if (!prayerDesc.trim()) {
      Alert.alert('Falta la descripción', 'Por favor describe tu petición para que los pastores podamos orar con detalle.');
      return;
    }
    setIsSubmittingPrayer(true);
    try {
      const requesterName = currentUser
        ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
        : 'Hermano(a) de la iglesia';
      const requesterPhone = prayerPhone.trim() || currentUser?.phone || undefined;

      await addPrayerRequest({
        memberId: currentUser?.id || 'anon',
        memberName: requesterName,
        memberPhone: requesterPhone,
        category: prayerCategory,
        title: prayerTitle.trim(),
        description: prayerDesc.trim(),
        isPrivateForPastors: prayerPrivate,
      });

      setPrayerTitle('');
      setPrayerDesc('');
      setPrayerPhone('');
      setPrayerPrivate(false);
      setPrayerTab('list');

      Alert.alert(
        '¡Petición Enviada!',
        'Tu petición ha sido entregada al equipo pastoral. Los Pastores Josué y Norelis la presentarán en oración ante el Señor.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo enviar la petición.');
    } finally {
      setIsSubmittingPrayer(false);
    }
  };

  const handleMarkPraying = async (prId: string) => {
    const pastorName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : 'Pastor';
    await updatePrayerRequestStatus(prId, 'praying', pastorName);
  };

  const handleMarkAnswered = async (prId: string) => {
    await updatePrayerRequestStatus(prId, 'answered');
  };

  if (isLoading && currentUser) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <View style={{ alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={{ color: '#F8FAFC', marginTop: 14, fontSize: 16, fontWeight: '700' }}>
            Planeador Pastoral
          </Text>
          <Text style={{ color: '#94A3B8', marginTop: 4, fontSize: 13 }}>
            Cargando información...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    if (authMode === 'register') {
      return <RegisterScreen onGoLogin={() => setAuthMode('login')} />;
    }
    return <LoginScreen onGoRegister={() => setAuthMode('register')} />;
  }

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas cerrar tu sesión actual?')
          : true;
      if (confirmed) {
        logout();
      }
      return;
    }

    Alert.alert('Cerrar Sesión', '¿Deseas cerrar tu sesión actual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  // Buscar versículo mediante bible-api.com
  const handleSearchVerse = async () => {
    if (!verseQuery.trim()) {
      setVerseFeedback('Por favor escribe la cita bíblica (ej: Juan 3:16, Filipenses 4:13).');
      return;
    }

    setIsSearchingVerse(true);
    setVerseFeedback(null);

    try {
      const result = await fetchBibleVerse(verseQuery.trim());
      if (result) {
        setSelectedVerse(result);
        setVerseFeedback(null);
      } else {
        setVerseFeedback(
          'No se encontró el versículo. Puedes escribirlo manualmente o escoger de los versículos sugeridos.'
        );
      }
    } catch {
      setVerseFeedback('Error al consultar Bible API. Verifica tu conexión.');
    } finally {
      setIsSearchingVerse(false);
    }
  };

  // Seleccionar versículo sugerido rápido
  const handleSelectQuickVerse = (v: QuickBibleVerse) => {
    setSelectedVerse(v);
    setVerseQuery(v.reference);
    setVerseFeedback(null);
  };

  // Publicar mensaje pastoral
  const handlePublishPost = async () => {
    if (!postTitle.trim() || !postContent.trim()) {
      Alert.alert('Faltan datos', 'Por favor ingresa un título y el contenido del mensaje.');
      return;
    }

    try {
      await addPastoralPost({
        authorId: currentUser.id,
        authorName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        authorRole: currentUser.role,
        authorNetwork: currentUser.network,
        network: postNetwork,
        title: postTitle.trim(),
        content: postContent.trim(),
        verse: selectedVerse || undefined,
      });

      // Limpiar formulario y cerrar modal
      setPostTitle('');
      setPostContent('');
      setSelectedVerse(null);
      setVerseQuery('');
      setVerseFeedback(null);
      setModalVisible(false);
      Alert.alert('¡Publicado!', 'Tu mensaje ha sido compartido con la congregación.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo publicar el mensaje.');
    }
  };

  const getRoleLabel = () => {
    if (currentUser.role === 'senior_pastor') return 'Pastor Principal';
    if (currentUser.generationLevel === 3) return 'Líder 144';
    if (currentUser.generationLevel === 4) return 'Líder 1728';
    if (currentUser.generationLevel === 2) return 'Líder 12';

    if (currentUser.leaderId) {
      const leader = members.find((m) => m.id === currentUser.leaderId);
      if (leader) {
        if (leader.role === 'senior_pastor') return 'Líder 12';
        return 'Líder 144';
      }
    }

    if (currentUser.leaderName) {
      const lName = currentUser.leaderName.toLowerCase();
      if (
        lName.includes('josue') ||
        lName.includes('josué') ||
        lName.includes('norelis')
      ) {
        return 'Líder 12';
      }
      return 'Líder 144';
    }

    if (currentUser.role === 'g12_leader' || currentUser.isLeaderOf12) {
      return 'Líder 12';
    }
    return 'Líder 144';
  };

  const nextMeta = nextEvent ? EVENT_TYPE_META[normalizeEventType(nextEvent.type)] : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar style="light" />

      {/* CONTENEDOR CON FONDO DEGRADADO Y LUCES AMBIENTALES */}
      <AuroraBackground>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* ========================================================= */}
          {/* HEADER HERO (Glassmorphic)                                */}
          {/* ========================================================= */}
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 58, 138, 0.38)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlassBanner}>
            <View style={styles.headerTopRow}>
              <View style={styles.churchBadge}>
                <Ionicons name="business" size={13} color="#38BDF8" />
                <Text style={styles.churchBadgeText}>IEC • Caja de Agua</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={styles.profileTopPill}
                  onPress={() => router.push('/profile' as any)}
                  activeOpacity={0.8}>
                  <Ionicons name="person-circle-outline" size={16} color="#38BDF8" />
                  <Text style={styles.profileTopPillText}>Mi Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutPill} onPress={handleLogout} activeOpacity={0.8}>
                  <Ionicons name="log-out-outline" size={14} color="#FB7185" />
                  <Text style={styles.logoutPillText}>Salir</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner de Usuario */}
            <TouchableOpacity
              style={styles.userProfileBanner}
              activeOpacity={0.85}
              onPress={() => router.push('/profile' as any)}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {currentUser.firstName?.[0] || 'U'}
                  {currentUser.lastName?.[0] || ''}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.userGreeting}>Bienvenido</Text>
                </View>
                <Text style={styles.userFullName}>
                  {currentUser.firstName} {currentUser.lastName}
                </Text>
                <View style={styles.userBadgesRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{getRoleLabel()}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Próximo Servicio Banner (Glass pill) */}
            {nextEvent && (
              <TouchableOpacity
                style={styles.compactEventPill}
                activeOpacity={0.85}
                onPress={() => router.push(`/planner/${nextEvent.id}` as any)}>
                <View style={styles.compactEventLeft}>
                  <Ionicons
                    name={(nextMeta?.icon as any) || 'calendar'}
                    size={14}
                    color="#38BDF8"
                  />
                  <Text style={styles.compactEventTitle} numberOfLines={1}>
                    Próximo: {nextEvent.title}
                  </Text>
                </View>
                <View style={styles.compactEventRight}>
                  <Text style={styles.compactEventDate}>
                    {formatEventDate(nextEvent.date, { short: true })} • {nextEvent.time}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#38BDF8" />
                </View>
              </TouchableOpacity>
            )}
          </LinearGradient>

          {/* ========================================================= */}
          {/* SWITCHER DE PÍLDORAS (DISCIPULADO vs ZONA INTERACTIVA)    */}
          {/* ========================================================= */}
          <View style={styles.tabsSwitcherRow}>
            <TouchableOpacity
              style={[
                styles.tabSwitcherPill,
                mainTab === 'discipulado' && styles.tabSwitcherPillActive,
              ]}
              onPress={() => setMainTab('discipulado')}
              activeOpacity={0.8}>
              <Ionicons
                name="grid-outline"
                size={16}
                color={mainTab === 'discipulado' ? '#38BDF8' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabSwitcherText,
                  mainTab === 'discipulado' && styles.tabSwitcherTextActive,
                ]}>
                Discipulado
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabSwitcherPill,
                mainTab === 'interactiva' && styles.tabSwitcherPillActive,
              ]}
              onPress={() => setMainTab('interactiva')}
              activeOpacity={0.8}>
              <Ionicons
                name="chatbubbles-outline"
                size={16}
                color={mainTab === 'interactiva' ? '#38BDF8' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.tabSwitcherText,
                  mainTab === 'interactiva' && styles.tabSwitcherTextActive,
                ]}>
                Zona interactiva
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================= */}
          {/* TAB 1: DISCIPULADO Y GESTIÓN (CARDS CON DEGRADADO Y LUZ)  */}
          {/* ========================================================= */}
          {mainTab === 'discipulado' && (
            <View style={{ paddingTop: 4 }}>
              {/* CARD 1: ASISTENCIA (LUZ AZUL/CYAN) */}
              <LinearGradient
                colors={['rgba(30, 58, 138, 0.45)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(56, 189, 248, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => router.push('/attendance' as any)}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(14, 165, 233, 0.22)',
                        borderColor: 'rgba(56, 189, 248, 0.5)',
                      },
                    ]}>
                    <Ionicons name="people" size={24} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Asistencia</Text>
                    <Text style={styles.glassCardSubtitle}>Visitantes, asistencia y niños</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/register' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                      ]}>
                      <Ionicons name="person-add-outline" size={16} color="#38BDF8" />
                    </View>
                    <Text style={styles.subActionLabel}>Registro de nuevos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/attendance' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(52, 211, 153, 0.2)' },
                      ]}>
                      <Ionicons name="checkmark-done-circle-outline" size={17} color="#34D399" />
                    </View>
                    <Text style={styles.subActionLabel}>Marcar asistencia</Text>
                  </TouchableOpacity>


                </View>
              </LinearGradient>

              {/* CARD 2: GRUPOS DE CONEXIÓN (LUZ TEAL/VERDE AZULADO) */}
              <LinearGradient
                colors={['rgba(13, 148, 136, 0.38)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(45, 212, 191, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => router.push('/cells' as any)}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(20, 184, 166, 0.22)',
                        borderColor: 'rgba(45, 212, 191, 0.5)',
                      },
                    ]}>
                    <Ionicons name="git-network" size={24} color="#2DD4BF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Grupos de conexión</Text>
                    <Text style={styles.glassCardSubtitle}>Tus sedes y células de crecimiento</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/cells' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(45, 212, 191, 0.2)' },
                      ]}>
                      <Ionicons name="home-outline" size={16} color="#2DD4BF" />
                    </View>
                    <Text style={styles.subActionLabel}>Mis células</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/cells' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(52, 211, 153, 0.2)' },
                      ]}>
                      <Ionicons name="document-text-outline" size={16} color="#34D399" />
                    </View>
                    <Text style={styles.subActionLabel}>Reporte semanal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/members' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(129, 140, 248, 0.2)' },
                      ]}>
                      <Ionicons name="people-circle-outline" size={17} color="#818CF8" />
                    </View>
                    <Text style={styles.subActionLabel}>Red G12</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* CARD 3: CUIDADO PASTORAL & PETICIONES (LUZ CORAL/ROSA) */}
              <LinearGradient
                colors={['rgba(225, 29, 72, 0.35)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(251, 113, 133, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => {
                    setPrayerTab('list');
                    setPrayerModalVisible(true);
                  }}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(244, 63, 94, 0.22)',
                        borderColor: 'rgba(251, 113, 133, 0.5)',
                      },
                    ]}>
                    <Ionicons name="heart-half" size={24} color="#FB7185" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Cuidado & Oración</Text>
                    <Text style={styles.glassCardSubtitle}>Peticiones personales y cumpleaños</Text>
                  </View>
                  {isPastor && pendingPrayersCount > 0 ? (
                    <View style={styles.cardNotifyPill}>
                      <Text style={styles.cardNotifyPillText}>{pendingPrayersCount} por orar</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>



                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => setBirthdayModalVisible(true)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(251, 113, 133, 0.2)' },
                      ]}>
                      <Ionicons name="gift-outline" size={16} color="#FB7185" />
                    </View>
                    <Text style={styles.subActionLabel}>Cumpleaños ({birthdaysThisMonthCount})</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPrayerTab(isPastor ? 'list' : 'create');
                      setPrayerModalVisible(true);
                    }}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
                      ]}>
                      <Ionicons name="sparkles-outline" size={16} color="#FBBF24" />
                    </View>
                    <Text style={styles.subActionLabel}>
                      {isPastor ? 'Ver Peticiones' : 'Mandar Petición'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPrayerTab('list');
                      setPrayerModalVisible(true);
                    }}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(52, 211, 153, 0.2)' },
                      ]}>
                      <Ionicons name="medkit-outline" size={16} color="#34D399" />
                    </View>
                    <Text style={styles.subActionLabel}>Cuidado Pastoral</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* CARD 4: LITURGIA Y CULTOS (LUZ VIOLETA) */}
              <LinearGradient
                colors={['rgba(109, 40, 217, 0.38)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(167, 139, 250, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => router.push('/planner' as any)}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(139, 92, 246, 0.22)',
                        borderColor: 'rgba(167, 139, 250, 0.5)',
                      },
                    ]}>
                    <Ionicons name="calendar" size={24} color="#A78BFA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Servicios</Text>
                    <Text style={styles.glassCardSubtitle}>
                      {nextEvent
                        ? `Próximo: ${nextEvent.title} (${nextEvent.time})`
                        : 'Órdenes de servicio y cronogramas'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push(nextEvent ? (`/planner/${nextEvent.id}` as any) : ('/planner' as any))
                    }>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(167, 139, 250, 0.2)' },
                      ]}>
                      <Ionicons name="time-outline" size={16} color="#A78BFA" />
                    </View>
                    <Text style={styles.subActionLabel}>Próximo Servicio</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/planner' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                      ]}>
                      <Ionicons name="calendar-number-outline" size={16} color="#38BDF8" />
                    </View>
                    <Text style={styles.subActionLabel}>Cronograma</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/ministries' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(244, 114, 182, 0.2)' },
                      ]}>
                      <Ionicons name="musical-notes-outline" size={16} color="#F472B6" />
                    </View>
                    <Text style={styles.subActionLabel}>Ministerios</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* CARD DEDICADA: MINISTERIOS & EQUIPOS DE SERVICIO */}
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.32)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(167, 139, 250, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => router.push('/ministries' as any)}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(139, 92, 246, 0.22)',
                        borderColor: 'rgba(167, 139, 250, 0.5)',
                      },
                    ]}>
                    <Ionicons name="ribbon" size={24} color="#A78BFA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Ministerios & Equipos</Text>
                    <Text style={styles.glassCardSubtitle}>
                      {ministries.length > 0
                        ? `${ministries.length} ministerios activos • Alabanza, Audiovisual, Protocolo...`
                        : 'Organiza y crea ministerios de la iglesia'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.subActionsRow}>
                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/ministries' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(139, 92, 246, 0.2)' },
                      ]}>
                      <Ionicons name="people-circle-outline" size={16} color="#A78BFA" />
                    </View>
                    <Text style={styles.subActionLabel}>Ver Ministerios</Text>
                  </TouchableOpacity>

                  {isPastor && (
                    <TouchableOpacity
                      style={styles.subActionItem}
                      activeOpacity={0.8}
                      onPress={() => router.push('/ministries' as any)}>
                      <View
                        style={[
                          styles.subActionIconBox,
                          { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                        ]}>
                        <Ionicons name="add-circle-outline" size={16} color="#38BDF8" />
                      </View>
                      <Text style={styles.subActionLabel}>+ Crear Nuevo</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/members' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
                      ]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                    </View>
                    <Text style={styles.subActionLabel}>Servidores</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* ========================================================= */}
          {/* TAB 2: ZONA INTERACTIVA (PALABRA PASTORAL & DEVOCIONALES) */}
          {/* ========================================================= */}
          {mainTab === 'interactiva' && (
            <View style={styles.sectionContainer}>
              {isPastor && (
                <TouchableOpacity
                  style={styles.createPostBtn}
                  activeOpacity={0.85}
                  onPress={handleOpenCreatePost}>
                  <View style={styles.createPostIconBox}>
                    <Ionicons name="create" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.createPostTitle}>Escribir Mensaje Pastoral</Text>
                    <Text style={styles.createPostSub}>
                      Comparte una palabra de fe, devocional y un versículo bíblico.
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={26} color="#38BDF8" />
                </TouchableOpacity>
              )}

              <View style={styles.feedHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={18} color="#38BDF8" />
                  <Text style={styles.feedTitle}>Palabra de los Pastores</Text>
                </View>
                <Text style={styles.feedSubtitle}>{visiblePosts.length} mensajes</Text>
              </View>

              {visiblePosts.length === 0 ? (
                <View style={styles.emptyFeedBox}>
                  <Ionicons name="book-outline" size={44} color="#64748B" />
                  <Text style={styles.emptyFeedTitle}>No hay mensajes publicados aún</Text>
                  <Text style={styles.emptyFeedDesc}>
                    {isPastor
                      ? 'Sé el primero en compartir un versículo y una palabra de bendición.'
                      : 'Pronto los pastores compartirán reflexiones y devocionales aquí.'}
                  </Text>
                </View>
              ) : (
                visiblePosts.map((post) => {
                  const hasLiked = currentUser ? post.likes.includes(currentUser.id) : false;
                  const isAuthor =
                    currentUser?.id === post.authorId || currentUser?.role === 'senior_pastor';

                  const authorMember = members.find((m) => m.id === post.authorId);
                  const authorNet = post.authorNetwork || authorMember?.network;

                  let authorRoleLabel = 'Pastor';
                  if (post.authorRole === 'senior_pastor') {
                    authorRoleLabel = 'Pastor Principal';
                  } else if (post.authorRole === 'network_pastor') {
                    authorRoleLabel = authorNet === 'juvenil' ? 'Pastor Juvenil' : 'Pastor Adultos';
                  } else if (post.authorRole === 'g12_leader') {
                    authorRoleLabel = authorNet === 'juvenil' ? 'Líder Juvenil' : 'Líder G12';
                  } else {
                    authorRoleLabel = 'Líder';
                  }

                  return (
                    <View key={post.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <View style={styles.postAuthorAvatar}>
                          <Text style={styles.postAuthorAvatarText}>
                            {post.authorName?.[0] || 'P'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postAuthorName}>{post.authorName}</Text>
                          <View style={styles.postAuthorMetaRow}>
                            <Text style={styles.postRoleBadge}>{authorRoleLabel}</Text>
                            <Text style={styles.postMetaDot}>•</Text>
                            <Text style={styles.postNetworkTag}>Toda la Iglesia</Text>
                          </View>
                        </View>

                        {isAuthor && (
                          <TouchableOpacity
                            onPress={() => {
                              if (Platform.OS === 'web') {
                                const confirmed =
                                  typeof window !== 'undefined'
                                    ? window.confirm(
                                      '¿Estás seguro de que deseas eliminar esta publicación?'
                                    )
                                    : true;
                                if (confirmed) {
                                  deletePastoralPost(post.id);
                                }
                                return;
                              }
                              Alert.alert(
                                'Eliminar Mensaje',
                                '¿Estás seguro de que deseas eliminar esta publicación?',
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Eliminar',
                                    style: 'destructive',
                                    onPress: () => deletePastoralPost(post.id),
                                  },
                                ]
                              );
                            }}>
                            <Ionicons name="trash-outline" size={17} color="#64748B" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.postTitleText}>{post.title}</Text>

                      {post.verse && (
                        <View style={styles.verseBox}>
                          <View style={styles.verseHeader}>
                            <Ionicons name="book" size={15} color="#38BDF8" />
                            <Text style={styles.verseRefText}>{post.verse.reference}</Text>
                            {post.verse.translation && (
                              <View style={styles.verseTransBadge}>
                                <Text style={styles.verseTransText}>{post.verse.translation}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.verseBodyText}>
                            &ldquo;{post.verse.text}&rdquo;
                          </Text>
                        </View>
                      )}

                      <Text style={styles.postContentText}>{post.content}</Text>

                      <View style={styles.postFooter}>
                        <TouchableOpacity
                          style={[styles.likeButton, hasLiked && styles.likeButtonActive]}
                          activeOpacity={0.8}
                          onPress={() => toggleLikePost(post.id)}>
                          <Ionicons
                            name={hasLiked ? 'heart' : 'heart-outline'}
                            size={18}
                            color={hasLiked ? '#FB7185' : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.likeButtonText,
                              hasLiked && styles.likeButtonTextActive,
                            ]}>
                            {post.likes.length}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </AuroraBackground>

      {/* ========================================================= */}
      {/* MODAL: ESCRIBIR MENSAJE PASTORAL (BIBLE API)              */}
      {/* ========================================================= */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="create" size={22} color="#38BDF8" />
                <Text style={styles.modalTitle}>Publicar Mensaje Pastoral</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <Text style={styles.modalInputLabel}>Título de la Reflexión / Mensaje</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="ej: Nuestra fuerza viene del Señor"
                placeholderTextColor="#64748B"
                value={postTitle}
                onChangeText={setPostTitle}
              />



              {/* SECCIÓN BIBLE API */}
              <View style={styles.bibleApiSection}>
                <View style={styles.bibleApiHeader}>
                  <Ionicons name="book" size={16} color="#38BDF8" />
                  <Text style={styles.bibleApiTitle}>Adjuntar Versículo (Biblia RVR1960)</Text>
                </View>
                <Text style={styles.bibleApiDesc}>
                  Escribe la cita (ej: Josué 1:9, Juan 3:16, Filipenses 4:13):
                </Text>

                <View style={styles.verseSearchRow}>
                  <TextInput
                    style={styles.verseSearchInput}
                    placeholder="ej: josue 1 9, juan 3:16"
                    placeholderTextColor="#64748B"
                    value={verseQuery}
                    onChangeText={setVerseQuery}
                  />
                  <TouchableOpacity
                    style={styles.verseSearchBtn}
                    onPress={handleSearchVerse}
                    disabled={isSearchingVerse}>
                    {isSearchingVerse ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="search" size={16} color="#FFFFFF" />
                        <Text style={styles.verseSearchBtnText}>Buscar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickVersesScroll}>
                  {POPULAR_VERSES.map((v) => (
                    <TouchableOpacity
                      key={v.reference}
                      style={[
                        styles.quickVerseChip,
                        selectedVerse?.reference === v.reference && styles.quickVerseChipActive,
                      ]}
                      onPress={() => handleSelectQuickVerse(v)}>
                      <Text
                        style={[
                          styles.quickVerseChipText,
                          selectedVerse?.reference === v.reference && styles.quickVerseChipTextActive,
                        ]}>
                        {v.reference}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {verseFeedback && (
                  <Text style={styles.verseFeedbackText}>{verseFeedback}</Text>
                )}

                {selectedVerse && (
                  <View style={styles.selectedVersePreview}>
                    <View style={styles.versePreviewHeader}>
                      <Text style={styles.versePreviewRef}>{selectedVerse.reference}</Text>
                      <TouchableOpacity onPress={() => setSelectedVerse(null)}>
                        <Ionicons name="close" size={18} color="#FB7185" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.verseEditText}
                      multiline
                      value={selectedVerse.text}
                      onChangeText={(t) =>
                        setSelectedVerse((prev) => (prev ? { ...prev, text: t } : null))
                      }
                    />
                  </View>
                )}
              </View>

              <Text style={styles.modalInputLabel}>Mensaje Pastoral / Reflexión</Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextArea]}
                placeholder="Escribe tu mensaje para edificar a la congregación..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={6}
                value={postContent}
                onChangeText={setPostContent}
              />

              <TouchableOpacity
                style={styles.publishSubmitBtn}
                activeOpacity={0.85}
                onPress={handlePublishPost}>
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                <Text style={styles.publishSubmitBtnText}>Publicar para la Iglesia</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: CUMPLEAÑOS DE LOS MIEMBROS                         */}
      {/* ========================================================= */}
      <Modal visible={birthdayModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="gift" size={22} color="#FB7185" />
                <Text style={styles.modalTitle}>Cumpleaños de la Iglesia</Text>
              </View>
              <TouchableOpacity onPress={() => setBirthdayModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Selector de Filtro de Cumpleaños */}
            <View style={styles.careFilterTabsRow}>
              <TouchableOpacity
                style={[
                  styles.careFilterTabBtn,
                  birthdayFilterTab === 'month' && styles.careFilterTabBtnActive,
                ]}
                onPress={() => setBirthdayFilterTab('month')}>
                <Text
                  style={[
                    styles.careFilterTabText,
                    birthdayFilterTab === 'month' && styles.careFilterTabTextActive,
                  ]}>
                  Este Mes ({birthdaysThisMonthCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.careFilterTabBtn,
                  birthdayFilterTab === 'next30' && styles.careFilterTabBtnActive,
                ]}
                onPress={() => setBirthdayFilterTab('next30')}>
                <Text
                  style={[
                    styles.careFilterTabText,
                    birthdayFilterTab === 'next30' && styles.careFilterTabTextActive,
                  ]}>
                  Próximos 30 días
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.careFilterTabBtn,
                  birthdayFilterTab === 'all' && styles.careFilterTabBtnActive,
                ]}
                onPress={() => setBirthdayFilterTab('all')}>
                <Text
                  style={[
                    styles.careFilterTabText,
                    birthdayFilterTab === 'all' && styles.careFilterTabTextActive,
                  ]}>
                  Todos ({birthdaysList.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {filteredBirthdays.length === 0 ? (
                <View style={styles.emptyCareBox}>
                  <Ionicons name="calendar-outline" size={36} color="#64748B" />
                  <Text style={styles.emptyCareText}>
                    No hay cumpleaños registrados con fecha de nacimiento para este criterio. Puedes ingresar o actualizar la fecha de nacimiento en el Directorio de miembros.
                  </Text>
                </View>
              ) : (
                filteredBirthdays.map(({ member: m, day, month, isToday, daysUntil, ageTurning }) => (
                  <View key={m.id} style={[styles.birthdayItemCard, isToday && styles.birthdayItemCardToday]}>
                    <View style={[styles.birthdayIconBox, isToday && { backgroundColor: 'rgba(251, 191, 36, 0.25)', borderColor: '#F59E0B' }]}>
                      <Text style={{ fontSize: 18 }}>{isToday ? '🎂' : '🎈'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.birthdayMemberName}>
                          {m.firstName} {m.lastName}
                        </Text>
                        {isToday && (
                          <View style={styles.todayBirthdayBadge}>
                            <Text style={styles.todayBirthdayBadgeText}>¡HOY! 🎉</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.birthdayDateText}>
                        🗓️ {day} de {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1]}
                        {ageTurning ? ` · Cumple ${ageTurning} años` : ''}
                      </Text>
                      <Text style={styles.birthdayCountdownText}>
                        {isToday
                          ? '✨ Celebrando hoy su cumpleaños'
                          : daysUntil === 1
                            ? '⏳ ¡Mañana es su cumpleaños!'
                            : `⏳ Faltan ${daysUntil} días`}
                      </Text>
                    </View>

                    {m.phone ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.birthdayWhatsAppBtn}
                          onPress={() => {
                            const clean = m.phone!.replace(/[^0-9]/g, '');
                            const msg = encodeURIComponent(
                              `¡Feliz Cumpleaños ${m.firstName}! 🎉🎂 Que el Señor te llene de salud, sabiduría y bendiciones en este nuevo año de vida. ¡Te mandamos un abrazo con mucho cariño desde la congregación IEC Caja de Agua! 🙏✨`
                            );
                            Linking.openURL(`https://wa.me/${clean}?text=${msg}`);
                          }}>
                          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.birthdayCallBtn}
                          onPress={() => Linking.openURL(`tel:${m.phone}`)}>
                          <Ionicons name="call" size={14} color="#38BDF8" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: PETICIONES DE ORACIÓN & CUIDADO PASTORAL           */}
      {/* ========================================================= */}
      <Modal visible={prayerModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="heart" size={22} color="#FB7185" />
                <Text style={styles.modalTitle}>Peticiones de Oración</Text>
              </View>
              <TouchableOpacity onPress={() => setPrayerModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Pestañas: Ver Peticiones / Mandar Petición */}
            <View style={styles.prayerTopTabsRow}>
              <TouchableOpacity
                style={[styles.prayerTopTabBtn, prayerTab === 'list' && styles.prayerTopTabBtnActive]}
                onPress={() => setPrayerTab('list')}>
                <Ionicons
                  name="list"
                  size={16}
                  color={prayerTab === 'list' ? '#FFFFFF' : '#94A3B8'}
                />
                <Text style={[styles.prayerTopTabText, prayerTab === 'list' && styles.prayerTopTabTextActive]}>
                  {isPastor ? 'Peticiones Recibidas' : 'Mis Peticiones'} ({visiblePrayerRequests.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.prayerTopTabBtn, prayerTab === 'create' && styles.prayerTopTabBtnActive]}
                onPress={() => setPrayerTab('create')}>
                <Ionicons
                  name="add-circle"
                  size={16}
                  color={prayerTab === 'create' ? '#FFFFFF' : '#94A3B8'}
                />
                <Text style={[styles.prayerTopTabText, prayerTab === 'create' && styles.prayerTopTabTextActive]}>
                  + Enviar Petición
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {prayerTab === 'list' ? (
                <View>
                  {/* Banner Pastoral */}
                  <View style={styles.careNoticeBox}>
                    <Ionicons name="sparkles" size={20} color="#38BDF8" />
                    <Text style={styles.careNoticeTitle}>&ldquo;La oración del justo es poderosa y eficaz&rdquo;</Text>
                    <Text style={styles.careNoticeDesc}>
                      Los Pastores Josué y Norelis presentan en el altar cada petición depositada por la congregación.
                    </Text>
                  </View>

                  {/* Filtro por estado para Pastores */}
                  {isPastor && (
                    <View style={styles.prayerFilterChipsRow}>
                      {[
                        { id: 'all', label: 'Todas' },
                        { id: 'pending', label: 'Pendientes' },
                        { id: 'praying', label: 'Orando 🙏' },
                        { id: 'answered', label: 'Atendidas' },
                      ].map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.prayerFilterChip,
                            prayerFilter === f.id && styles.prayerFilterChipActive,
                          ]}
                          onPress={() => setPrayerFilter(f.id as any)}>
                          <Text
                            style={[
                              styles.prayerFilterChipText,
                              prayerFilter === f.id && styles.prayerFilterChipTextActive,
                            ]}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {visiblePrayerRequests.length === 0 ? (
                    <View style={styles.emptyCareBox}>
                      <Ionicons name="heart-outline" size={38} color="#64748B" />
                      <Text style={styles.emptyCareText}>
                        {isPastor
                          ? 'No hay peticiones de oración pendientes con este filtro.'
                          : 'Aún no has enviado peticiones de oración a los pastores.'}
                      </Text>
                      {!isPastor && (
                        <TouchableOpacity
                          style={[styles.publishSubmitBtn, { marginTop: 12 }]}
                          onPress={() => setPrayerTab('create')}>
                          <Ionicons name="add" size={18} color="#FFFFFF" />
                          <Text style={styles.publishSubmitBtnText}>Enviar mi primera petición</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    visiblePrayerRequests.map((req) => {
                      const isPending = req.status === 'pending';
                      const isPraying = req.status === 'praying';
                      const isAnswered = req.status === 'answered';

                      return (
                        <View key={req.id} style={styles.prayerCard}>
                          <View style={styles.prayerCardHeader}>
                            <View style={styles.prayerCategoryPill}>
                              <Ionicons
                                name={
                                  req.category === 'salud'
                                    ? 'medkit'
                                    : req.category === 'familia'
                                      ? 'people'
                                      : req.category === 'finanzas'
                                        ? 'cash'
                                        : req.category === 'espiritual'
                                          ? 'flame'
                                          : 'heart'
                                }
                                size={12}
                                color="#FB7185"
                              />
                              <Text style={styles.prayerCategoryPillText}>
                                {req.category.toUpperCase()}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.prayerStatusBadge,
                                isPraying && styles.prayerStatusBadgePraying,
                                isAnswered && styles.prayerStatusBadgeAnswered,
                              ]}>
                              <Text
                                style={[
                                  styles.prayerStatusBadgeText,
                                  isPraying && styles.prayerStatusBadgeTextPraying,
                                  isAnswered && styles.prayerStatusBadgeTextAnswered,
                                ]}>
                                {isPending ? '🟡 En espera' : isPraying ? '🙏 Orando' : '✅ Atendida'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.prayerCardTitle}>{req.title}</Text>
                          <Text style={styles.prayerCardDesc}>{req.description}</Text>

                          <View style={styles.prayerMetaRow}>
                            <Ionicons name="person-circle-outline" size={14} color="#94A3B8" />
                            <Text style={styles.prayerMetaText}>
                              De: <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>{req.memberName}</Text>
                              {req.isPrivateForPastors ? ' · (🔒 Privada para Pastores)' : ''}
                            </Text>
                          </View>

                          {/* Notificación para el solicitante cuando los pastores oran */}
                          {isPraying && req.prayingPastors && req.prayingPastors.length > 0 && (
                            <View style={styles.prayingPastorsBanner}>
                              <Ionicons name="shield-checkmark" size={14} color="#34D399" />
                              <Text style={styles.prayingPastorsBannerText}>
                                Cobertura pastoral activa: {req.prayingPastors.join(', ')}
                              </Text>
                            </View>
                          )}

                          {/* BOTÓN PRINCIPAL Y UNIVERSAL: ORAR POR ELLA (VISIBLE PARA TODOS) */}
                          {(() => {
                            const isUserPraying = Boolean(
                              currentUser && req.prayingUsers?.includes(currentUser.id)
                            );
                            return (
                              <TouchableOpacity
                                style={[
                                  styles.prayUniversalBtn,
                                  isUserPraying && styles.prayUniversalBtnActive,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => togglePrayerSupport(req.id)}>
                                <Ionicons
                                  name={isUserPraying ? 'heart' : 'heart-outline'}
                                  size={18}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.prayUniversalBtnText}>
                                  {isUserPraying
                                    ? '🙏 Estás orando por esta petición'
                                    : '🙏 Orar por ella'}
                                </Text>
                                {(req.prayingCount || 0) > 0 && (
                                  <View style={styles.prayingCountBadge}>
                                    <Text style={styles.prayingCountBadgeText}>
                                      {req.prayingCount} {req.prayingCount === 1 ? 'orando' : 'orando'}
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })()}

                          {/* Acciones de gestión para Pastores */}
                          {isPastor && (
                            <View style={styles.prayerPastorActionsRow}>
                              {!isAnswered && (
                                <TouchableOpacity
                                  style={styles.answerActionBtn}
                                  onPress={() => handleMarkAnswered(req.id)}>
                                  <Ionicons name="checkmark-done" size={14} color="#10B981" />
                                  <Text style={styles.answerActionBtnText}>Atendida</Text>
                                </TouchableOpacity>
                              )}

                              {req.memberPhone && (
                                <TouchableOpacity
                                  style={styles.prayerWhatsAppBtn}
                                  onPress={() => {
                                    const clean = req.memberPhone!.replace(/[^0-9]/g, '');
                                    const text = encodeURIComponent(
                                      `Hola ${req.memberName}, te saludamos los pastores de la iglesia. Queremos que sepas que estamos orando por tu petición: "${req.title}". ¡Dios tiene el control y su paz sobrepasa todo entendimiento! 🙏✨`
                                    );
                                    Linking.openURL(`https://wa.me/${clean}?text=${text}`);
                                  }}>
                                  <Ionicons name="logo-whatsapp" size={14} color="#22C55E" />
                                  <Text style={styles.prayerWhatsAppBtnText}>Escribir</Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={styles.prayerDeleteBtn}
                                onPress={() => deletePrayerRequest(req.id)}>
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* Aliento por WhatsApp para hermanos e intercesores */}
                          {!isPastor && req.memberPhone && !req.isPrivateForPastors && (
                            <View style={styles.prayerPastorActionsRow}>
                              <TouchableOpacity
                                style={styles.prayerWhatsAppBtn}
                                onPress={() => {
                                  const clean = req.memberPhone!.replace(/[^0-9]/g, '');
                                  const text = encodeURIComponent(
                                    `Hola ${req.memberName}, me uno en oración a tu motivo: "${req.title}". ¡Dios es fiel y escuchará el clamor de su pueblo! 🙏❤️`
                                  );
                                  Linking.openURL(`https://wa.me/${clean}?text=${text}`);
                                }}>
                                <Ionicons name="logo-whatsapp" size={14} color="#22C55E" />
                                <Text style={styles.prayerWhatsAppBtnText}>Enviar palabra de aliento</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              ) : (
                /* FORMULARIO DE NUEVA PETICIÓN */
                <View style={styles.prayerForm}>
                  <Text style={styles.formHeaderTitle}>Deposita tu petición ante Dios</Text>
                  <Text style={styles.formHeaderSub}>
                    Esta petición será recibida de forma directa por el Pastor Josué Rodríguez y la Pastora Norelis para su intercesión.
                  </Text>

                  {/* Categoría */}
                  <Text style={styles.modalInputLabel}>Área de la Petición *</Text>
                  <View style={styles.categorySelectRow}>
                    {[
                      { id: 'salud', label: 'Salud 🏥' },
                      { id: 'familia', label: 'Familia 👨‍👩‍👧' },
                      { id: 'finanzas', label: 'Provisión 💼' },
                      { id: 'espiritual', label: 'Espiritual 🕊️' },
                      { id: 'otro', label: 'Otro ✨' },
                    ].map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.categorySelectChip,
                          prayerCategory === c.id && styles.categorySelectChipActive,
                        ]}
                        onPress={() => setPrayerCategory(c.id as any)}>
                        <Text
                          style={[
                            styles.categorySelectChipText,
                            prayerCategory === c.id && styles.categorySelectChipTextActive,
                          ]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Título / Motivo */}
                  <Text style={styles.modalInputLabel}>Motivo o Título *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Ej: Sanidad para mi abuela, Empleo para mi esposo..."
                    placeholderTextColor="#64748B"
                    value={prayerTitle}
                    onChangeText={setPrayerTitle}
                  />

                  {/* Descripción */}
                  <Text style={styles.modalInputLabel}>Detalle de la Petición *</Text>
                  <TextInput
                    style={[styles.modalTextInput, { height: 90, textAlignVertical: 'top' }]}
                    placeholder="Escribe los detalles para que podamos presentarlo en el altar con precisión..."
                    placeholderTextColor="#64748B"
                    value={prayerDesc}
                    onChangeText={setPrayerDesc}
                    multiline
                  />

                  {/* Teléfono de contacto */}
                  <Text style={styles.modalInputLabel}>Teléfono de Contacto (opcional)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder={currentUser?.phone || 'Ej: 0412-1234567'}
                    placeholderTextColor="#64748B"
                    value={prayerPhone}
                    onChangeText={setPrayerPhone}
                    keyboardType="phone-pad"
                  />

                  {/* Switch de Privacidad */}
                  <View style={styles.privacyRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.privacyTitle}>🔒 Petición Confidencial</Text>
                      <Text style={styles.privacySub}>
                        Solo los Pastores Principales podrán ver el contenido de tu petición.
                      </Text>
                    </View>
                    <Switch
                      value={prayerPrivate}
                      onValueChange={setPrayerPrivate}
                      trackColor={{ false: '#334155', true: '#FB7185' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.publishSubmitBtn, isSubmittingPrayer && { opacity: 0.6 }]}
                    activeOpacity={0.85}
                    disabled={isSubmittingPrayer}
                    onPress={handleSendPrayerRequest}>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.publishSubmitBtnText}>
                      {isSubmittingPrayer ? 'Enviando...' : 'Enviar Petición a los Pastores'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070A14',
  },
  gradientContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#070A14',
  },
  // LUCES Y RESPLANDORES AURORA (MALLA DE LUCES AMBIENTALES)
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
    ...Platform.select({
      web: {
        filter: 'blur(100px)',
      },
    }),
  },
  orbBlue: {
    top: 30,
    right: -80,
    width: 380,
    height: 380,
    backgroundColor: 'rgba(37, 99, 235, 0.45)',
  },
  orbTeal: {
    top: 240,
    left: -100,
    width: 360,
    height: 360,
    backgroundColor: 'rgba(13, 148, 136, 0.42)',
  },
  orbRose: {
    top: 480,
    right: -90,
    width: 360,
    height: 360,
    backgroundColor: 'rgba(225, 29, 72, 0.38)',
  },
  orbEmerald: {
    top: 720,
    left: -90,
    width: 370,
    height: 370,
    backgroundColor: 'rgba(5, 150, 105, 0.38)',
  },
  scrollContainer: {
    paddingBottom: 110,
    backgroundColor: 'transparent',
  },
  // HERO BANNER
  heroGlassBanner: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  churchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  churchBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.3)',
  },
  logoutPillText: {
    color: '#FB7185',
    fontSize: 11,
    fontWeight: '700',
  },
  profileTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  profileTopPillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  manageProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  manageProfileChipText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  userProfileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  userGreeting: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userFullName: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '900',
  },
  userBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  roleBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
  },
  networkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  networkBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  compactEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  compactEventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactEventTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  compactEventRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactEventDate: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },

  // TOP SWITCHER PILLS (Discipulado / Zona interactiva)
  tabsSwitcherRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  tabSwitcherPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabSwitcherPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  tabSwitcherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabSwitcherTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // CARDS GLASSMORPHIC (CON BORDES DE LUZ Y DEGRADADO)
  glassCard: {
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1.2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 5,
  },
  glassCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  badgeGlowCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  glassCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  glassCardSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  subActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subActionItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subActionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  subActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 14,
  },

  // FEED ZONA INTERACTIVA
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  createPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  createPostIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  createPostSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  feedSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyFeedBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyFeedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 12,
  },
  emptyFeedDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 17,
  },
  postCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  postAuthorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAuthorAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38BDF8',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  postAuthorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  postRoleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  postMetaDot: {
    color: '#64748B',
    fontSize: 10,
  },
  postNetworkTag: {
    fontSize: 11,
    color: '#94A3B8',
  },
  postTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 22,
  },
  verseBox: {
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    marginBottom: 10,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  verseRefText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  verseTransBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verseTransText: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '700',
  },
  verseBodyText: {
    fontSize: 12,
    color: '#E0E7FF',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  postContentText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  likeButtonActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: 'rgba(251, 113, 133, 0.45)',
  },
  likeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  likeButtonTextActive: {
    color: '#FB7185',
  },

  // MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 10,
  },
  modalTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  networkSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  networkOptionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  networkOptionBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  networkOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  networkOptionTextActive: {
    color: '#38BDF8',
  },
  bibleApiSection: {
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  bibleApiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bibleApiTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  bibleApiDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 8,
  },
  verseSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verseSearchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#FFFFFF',
  },
  verseSearchBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  verseSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quickVersesScroll: {
    marginTop: 8,
    marginBottom: 4,
  },
  quickVerseChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  quickVerseChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  quickVerseChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  quickVerseChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  verseFeedbackText: {
    fontSize: 11,
    color: '#FB7185',
    marginTop: 4,
  },
  selectedVersePreview: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  versePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  versePreviewRef: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  verseEditText: {
    fontSize: 12,
    color: '#F8FAFC',
    fontStyle: 'italic',
    lineHeight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  publishSubmitBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 18,
  },
  publishSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // ESTILOS MODAL CUMPLEAÑOS Y CUIDADO
  careModalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  emptyCareBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyCareText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
  birthdayItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  birthdayIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.3)',
  },
  birthdayMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  birthdayDateText: {
    fontSize: 12,
    color: '#FB7185',
    fontWeight: '700',
    marginTop: 2,
  },
  birthdayPhoneText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  careNoticeBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    alignItems: 'center',
  },
  careNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 8,
    textAlign: 'center',
  },
  careNoticeDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  coverageRow: {
    gap: 8,
  },
  coverageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  coverageTitle: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coverageName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  coverageSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },

  // ESTILOS NUEVOS PARA CUIDADO & PETICIONES DE ORACIÓN
  cardNotifyPill: {
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardNotifyPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  careFilterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  careFilterTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  careFilterTabBtnActive: {
    backgroundColor: 'rgba(251, 113, 133, 0.25)',
    borderColor: '#FB7185',
  },
  careFilterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  careFilterTabTextActive: {
    color: '#FDA4AF',
  },
  birthdayItemCardToday: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  todayBirthdayBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBirthdayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  birthdayCountdownText: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 1,
    fontWeight: '600',
  },
  birthdayWhatsAppBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  birthdayCallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Pestañas Peticiones de Oración
  prayerTopTabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  prayerTopTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  prayerTopTabBtnActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    borderColor: '#FB7185',
  },
  prayerTopTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  prayerTopTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Filtros de peticiones
  prayerFilterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 10,
  },
  prayerFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  prayerFilterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  prayerFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  prayerFilterChipTextActive: {
    color: '#38BDF8',
  },

  // Tarjeta de Petición
  prayerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  prayerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  prayerCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prayerCategoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDA4AF',
  },
  prayerStatusBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prayerStatusBadgePraying: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  prayerStatusBadgeAnswered: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  prayerStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  prayerStatusBadgeTextPraying: {
    color: '#60A5FA',
  },
  prayerStatusBadgeTextAnswered: {
    color: '#34D399',
  },
  prayerCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  prayerCardDesc: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 10,
  },
  prayerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  prayerMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  prayingPastorsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  prayingPastorsBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  prayerPastorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  prayUniversalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E11D48',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  prayUniversalBtnActive: {
    backgroundColor: '#059669',
  },
  prayUniversalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  prayingCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  prayingCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  // Motivo de oración en Dashboard Card
  dashboardPrayerBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 4,
    marginTop: 12,
    marginBottom: 4,
  },
  dashboardPrayerBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dashboardPrayerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dashboardPrayerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDA4AF',
  },
  dashboardPrayerAuthorText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dashboardPrayerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  dashboardPrayerDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
    marginBottom: 10,
  },
  dashboardPrayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E11D48',
    paddingVertical: 9,
    borderRadius: 10,
  },
  dashboardPrayBtnActive: {
    backgroundColor: '#059669',
  },
  dashboardPrayBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dashboardPrayCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  dashboardPrayCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  prayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  prayActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  answerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  answerActionBtnText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  prayerWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  prayerWhatsAppBtnText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  prayerDeleteBtn: {
    padding: 6,
    marginLeft: 'auto',
  },

  // Formulario de Petición
  prayerForm: {
    marginTop: 4,
  },
  formHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formHeaderSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 17,
  },
  categorySelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  categorySelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categorySelectChipActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    borderColor: '#FB7185',
  },
  categorySelectChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  categorySelectChipTextActive: {
    color: '#FDA4AF',
    fontWeight: '800',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  privacySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
});
