import { useChurch } from '@/context/ChurchContext';
import { fetchBibleVerse, POPULAR_VERSES, QuickBibleVerse } from '@/lib/bible';
import {
  EVENT_TYPE_META,
  formatEventDate,
  normalizeEventType,
  sortEventsAsc,
  todayISO,
} from '@/lib/events';
import { AuroraBackground } from '@/components/aurora-background';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import LoginScreen from './login';
import RegisterScreen from './register';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    currentUser,
    isLoading,
    members,
    getVisibleEvents,
    logout,
    pastoralPosts,
    addPastoralPost,
    toggleLikePost,
    deletePastoralPost,
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

  // Estado del versículo bíblico adjunto
  const [verseQuery, setVerseQuery] = useState('');
  const [isSearchingVerse, setIsSearchingVerse] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<{
    reference: string;
    text: string;
    translation: string;
  } | null>(null);
  const [verseFeedback, setVerseFeedback] = useState<string | null>(null);

  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const handleOpenCreatePost = () => {
    setPostNetwork(currentUser?.role === 'network_pastor' ? currentUser.network : 'general');
    setModalVisible(true);
  };

  // Próximo evento filtrado por red
  const visibleEvents = useMemo(() => {
    return getVisibleEvents(currentUser);
  }, [getVisibleEvents, currentUser]);

  const today = todayISO();
  const nextEvent = useMemo(() => {
    const sorted = sortEventsAsc(visibleEvents);
    return sorted.find((e) => e.date >= today) || sorted[0] || visibleEvents[0];
  }, [visibleEvents, today]);

  // Mensajes pastorales visibles según la red del usuario
  const visiblePosts = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'senior_pastor') {
      return pastoralPosts;
    }
    return pastoralPosts.filter((p) => {
      if (!p.network || p.network === 'general') return true;
      return p.network === currentUser.network;
    });
  }, [pastoralPosts, currentUser]);

  // Cumpleañeros del mes actual
  const upcomingBirthdays = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    return members
      .filter((m) => {
        if (!m.birthDate) return false;
        const parts = m.birthDate.split('-');
        if (parts.length >= 2) {
          const month = parseInt(parts[1], 10);
          return month === currentMonth;
        }
        return false;
      })
      .sort((a, b) => {
        const dayA = parseInt(a.birthDate?.split('-')[2] || '0', 10);
        const dayB = parseInt(b.birthDate?.split('-')[2] || '0', 10);
        return dayA - dayB;
      });
  }, [members]);

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
    if (currentUser.role === 'network_pastor') {
      return currentUser.network === 'juvenil' ? 'Pastor Juvenil' : 'Pastor Adultos';
    }
    if (currentUser.generationLevel === 3) return 'Líder 144';
    if (currentUser.generationLevel === 4) return 'Líder 1728';
    if (currentUser.generationLevel === 2) return 'Líder 12';

    if (currentUser.leaderId) {
      const leader = members.find((m) => m.id === currentUser.leaderId);
      if (leader) {
        if (leader.role === 'senior_pastor') return 'Pastor de Red';
        if (leader.role === 'network_pastor') return 'Líder 12';
        return 'Líder 144';
      }
    }

    if (currentUser.leaderName) {
      const lName = currentUser.leaderName.toLowerCase();
      if (
        lName.includes('josue') ||
        lName.includes('josué') ||
        lName.includes('norelis') ||
        lName.includes('carlos diez') ||
        lName.includes('neiyelis')
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
                  <View style={styles.manageProfileChip}>
                    <Text style={styles.manageProfileChipText}>Configurar</Text>
                    <Ionicons name="chevron-forward" size={11} color="#38BDF8" />
                  </View>
                </View>
                <Text style={styles.userFullName}>
                  {currentUser.firstName} {currentUser.lastName}
                </Text>
                <View style={styles.userBadgesRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{getRoleLabel()}</Text>
                  </View>
                  <View
                    style={[
                      styles.networkBadge,
                      {
                        backgroundColor:
                          currentUser.network === 'juvenil'
                            ? 'rgba(167, 139, 250, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        borderColor:
                          currentUser.network === 'juvenil'
                            ? 'rgba(167, 139, 250, 0.4)'
                            : 'rgba(56, 189, 248, 0.4)',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.networkBadgeText,
                        {
                          color:
                            currentUser.network === 'juvenil'
                              ? '#C4B5FD'
                              : '#7DD3FC',
                        },
                      ]}>
                      {currentUser.role === 'senior_pastor'
                        ? 'Todas las Redes'
                        : currentUser.network === 'juvenil'
                          ? 'Red Juvenil'
                          : 'Red Adulta'}
                    </Text>
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

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/kids' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
                      ]}>
                      <Ionicons name="happy-outline" size={17} color="#FBBF24" />
                    </View>
                    <Text style={styles.subActionLabel}>Check-in de niños</Text>
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

              {/* CARD 3: CUIDADO PASTORAL (LUZ CORAL/ROSA) */}
              <LinearGradient
                colors={['rgba(225, 29, 72, 0.35)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(251, 113, 133, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => setPrayerModalVisible(true)}>
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
                    <Text style={styles.glassCardTitle}>Cuidado Pastoral</Text>
                    <Text style={styles.glassCardSubtitle}>Cumpleaños, oración y salud</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
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
                    <Text style={styles.subActionLabel}>Cumpleaños</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => setPrayerModalVisible(true)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
                      ]}>
                      <Ionicons name="sparkles-outline" size={16} color="#FBBF24" />
                    </View>
                    <Text style={styles.subActionLabel}>Oración</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => setPrayerModalVisible(true)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(52, 211, 153, 0.2)' },
                      ]}>
                      <Ionicons name="medkit-outline" size={16} color="#34D399" />
                    </View>
                    <Text style={styles.subActionLabel}>Salud y cuidado</Text>
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
                    <Text style={styles.glassCardTitle}>Liturgia y Cultos</Text>
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
                    <Text style={styles.subActionLabel}>Próximo Culto</Text>
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

              {/* CARD 5: DONACIONES Y REPORTES (LUZ ESMERALDA/DORADA) */}
              <LinearGradient
                colors={['rgba(5, 150, 105, 0.38)', 'rgba(15, 23, 42, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.glassCard, { borderColor: 'rgba(52, 211, 153, 0.35)' }]}>
                <TouchableOpacity
                  style={styles.glassCardHeader}
                  activeOpacity={0.8}
                  onPress={() => router.push('/attendance' as any)}>
                  <View
                    style={[
                      styles.badgeGlowCircle,
                      {
                        backgroundColor: 'rgba(245, 158, 11, 0.22)',
                        borderColor: 'rgba(251, 191, 36, 0.5)',
                      },
                    ]}>
                    <Ionicons name="trending-up" size={24} color="#FBBF24" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassCardTitle}>Donaciones y Reportes</Text>
                    <Text style={styles.glassCardSubtitle}>Lo recogido en cada servicio y célula</Text>
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
                        { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
                      ]}>
                      <Ionicons name="wallet-outline" size={16} color="#FBBF24" />
                    </View>
                    <Text style={styles.subActionLabel}>Ofrendas Célula</Text>
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
                      <Ionicons name="bar-chart-outline" size={16} color="#34D399" />
                    </View>
                    <Text style={styles.subActionLabel}>Consolidación</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subActionItem}
                    activeOpacity={0.8}
                    onPress={() => router.push('/members' as any)}>
                    <View
                      style={[
                        styles.subActionIconBox,
                        { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                      ]}>
                      <Ionicons name="people-outline" size={16} color="#38BDF8" />
                    </View>
                    <Text style={styles.subActionLabel}>Directorio</Text>
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
                            <Text style={styles.postNetworkTag}>
                              {post.network === 'general'
                                ? 'Toda la Iglesia'
                                : post.network === 'juvenil'
                                  ? 'Para: Red Juvenil'
                                  : 'Para: Red Adulta'}
                            </Text>
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

              <Text style={styles.modalInputLabel}>Dirigido a:</Text>
              <View style={styles.networkSelectRow}>
                <TouchableOpacity
                  style={[
                    styles.networkOptionBtn,
                    postNetwork === 'general' && styles.networkOptionBtnActive,
                  ]}
                  onPress={() => setPostNetwork('general')}>
                  <Text
                    style={[
                      styles.networkOptionText,
                      postNetwork === 'general' && styles.networkOptionTextActive,
                    ]}>
                    Toda la Iglesia
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.networkOptionBtn,
                    postNetwork === 'adulta' && styles.networkOptionBtnActive,
                  ]}
                  onPress={() => setPostNetwork('adulta')}>
                  <Text
                    style={[
                      styles.networkOptionText,
                      postNetwork === 'adulta' && styles.networkOptionTextActive,
                    ]}>
                    Red Adulta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.networkOptionBtn,
                    postNetwork === 'juvenil' && styles.networkOptionBtnActive,
                  ]}
                  onPress={() => setPostNetwork('juvenil')}>
                  <Text
                    style={[
                      styles.networkOptionText,
                      postNetwork === 'juvenil' && styles.networkOptionTextActive,
                    ]}>
                    Red Juvenil
                  </Text>
                </TouchableOpacity>
              </View>

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
      {/* MODAL: CUMPLEAÑOS DEL MES                                 */}
      {/* ========================================================= */}
      <Modal visible={birthdayModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="gift" size={22} color="#FB7185" />
                <Text style={styles.modalTitle}>Cumpleaños del Mes</Text>
              </View>
              <TouchableOpacity onPress={() => setBirthdayModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.careModalSubtitle}>
                Hermanos y discípulos que celebran la vida este mes:
              </Text>

              {upcomingBirthdays.length === 0 ? (
                <View style={styles.emptyCareBox}>
                  <Ionicons name="calendar-outline" size={36} color="#64748B" />
                  <Text style={styles.emptyCareText}>
                    No hay fechas de cumpleaños registradas para este mes. Puedes actualizar las fechas en el Directorio.
                  </Text>
                </View>
              ) : (
                upcomingBirthdays.map((m) => (
                  <View key={m.id} style={styles.birthdayItemCard}>
                    <View style={styles.birthdayIconBox}>
                      <Ionicons name="balloon-outline" size={20} color="#FB7185" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.birthdayMemberName}>
                        {m.firstName} {m.lastName}
                      </Text>
                      <Text style={styles.birthdayDateText}>
                        🎂 {m.birthDate} • {m.network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
                      </Text>
                      {m.phone ? (
                        <Text style={styles.birthdayPhoneText}>Tel: {m.phone}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: ORACIÓN Y CUIDADO PASTORAL                         */}
      {/* ========================================================= */}
      <Modal visible={prayerModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="heart" size={22} color="#FB7185" />
                <Text style={styles.modalTitle}>Cuidado Pastoral & Oración</Text>
              </View>
              <TouchableOpacity onPress={() => setPrayerModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.careNoticeBox}>
                <Ionicons name="sparkles" size={24} color="#38BDF8" />
                <Text style={styles.careNoticeTitle}>&ldquo;La oración del justo es poderosa y eficaz&rdquo;</Text>
                <Text style={styles.careNoticeDesc}>
                  Santiago 5:16 — El equipo pastoral y los líderes de 12 están en continuo clamor por las familias, peticiones de salud, fortaleza y crecimiento de la iglesia.
                </Text>
              </View>

              <Text style={[styles.modalInputLabel, { marginTop: 16 }]}>Líneas de Cobertura:</Text>
              <View style={styles.coverageRow}>
                <View style={styles.coverageCard}>
                  <Text style={styles.coverageTitle}>Pastores Principales</Text>
                  <Text style={styles.coverageName}>Pr. José & Pra. Neidy Peña</Text>
                  <Text style={styles.coverageSub}>Sede Central IEC</Text>
                </View>
                <View style={styles.coverageCard}>
                  <Text style={styles.coverageTitle}>Pastores de Red</Text>
                  <Text style={styles.coverageName}>Pr. Carlos & Pra. Neiyelis</Text>
                  <Text style={styles.coverageSub}>Red Adulta • Adultos</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.publishSubmitBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setPrayerModalVisible(false);
                  setMainTab('interactiva');
                }}>
                <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
                <Text style={styles.publishSubmitBtnText}>Ver Reflexiones y Devocionales</Text>
              </TouchableOpacity>
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
});
