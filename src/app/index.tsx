import { useChurch } from '@/context/ChurchContext';
import { fetchBibleVerse, POPULAR_VERSES, QuickBibleVerse } from '@/lib/bible';
import {
  EVENT_TYPE_META,
  formatEventDate,
  normalizeEventType,
  sortEventsAsc,
  todayISO,
} from '@/lib/events';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './login';

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
    quickDemoLogin,
  } = useChurch();

  const [showDemoSelector, setShowDemoSelector] = useState(false);

  // Modal para escribir nuevo mensaje pastoral
  const [modalVisible, setModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postNetwork, setPostNetwork] = useState<'general' | 'adulta' | 'juvenil'>('general');

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

  if (isLoading && currentUser) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="light" />
        <View style={{ alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={{ color: '#E0E7FF', marginTop: 14, fontSize: 16, fontWeight: '700' }}>
            Planeador Pastoral
          </Text>
          <Text style={{ color: '#93C5FD', marginTop: 4, fontSize: 13 }}>
            Cargando información...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const handleLogout = () => {
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
    if (currentUser.generationLevel === 2 || currentUser.role === 'g12_leader') {
      return 'Líder de 12';
    }
    return 'Líder G12';
  };

  const nextMeta = nextEvent ? EVENT_TYPE_META[normalizeEventType(nextEvent.type)] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('@/assets/images/doodle-pattern-light.png')}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.15 }}
        resizeMode="repeat">
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* ========================================================= */}
        {/* HEADER HERO                                               */}
        {/* ========================================================= */}
        <View style={styles.heroBanner}>
          <View style={styles.headerTopRow}>
            <View style={styles.churchBadge}>
              <Ionicons name="business" size={13} color="#93C5FD" />
              <Text style={styles.churchBadgeText}>Sede Central • Comunidad de Fe</Text>
            </View>

            <TouchableOpacity style={styles.logoutPill} onPress={handleLogout} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={14} color="#FCA5A5" />
              <Text style={styles.logoutPillText}>Salir</Text>
            </TouchableOpacity>
          </View>

          {/* User Profile Info */}
          <View style={styles.userProfileBanner}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {currentUser.firstName?.[0] || 'U'}
                {currentUser.lastName?.[0] || ''}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userGreeting}>Palabra Pastoral & Comunidad</Text>
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
                          ? 'rgba(139, 92, 246, 0.35)'
                          : 'rgba(59, 130, 246, 0.35)',
                    },
                  ]}>
                  <Text style={styles.networkBadgeText}>
                    {currentUser.role === 'senior_pastor'
                      ? 'Todas las Redes'
                      : currentUser.network === 'juvenil'
                      ? 'Red Juvenil'
                      : 'Red Adulta'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Banner Próximo Culto (Compacto) */}
          {nextEvent && (
            <TouchableOpacity
              style={styles.compactEventPill}
              activeOpacity={0.85}
              onPress={() => router.push(`/planner/${nextEvent.id}` as any)}>
              <View style={styles.compactEventLeft}>
                <Ionicons
                  name={(nextMeta?.icon as any) || 'calendar'}
                  size={14}
                  color="#60A5FA"
                />
                <Text style={styles.compactEventTitle} numberOfLines={1}>
                  Próximo: {nextEvent.title}
                </Text>
              </View>
              <View style={styles.compactEventRight}>
                <Text style={styles.compactEventDate}>
                  {formatEventDate(nextEvent.date, { short: true })} • {nextEvent.time}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#93C5FD" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================= */}
        {/* BOTÓN DE CREAR MENSAJE PASTORAL (SOLO PASTORES)           */}
        {/* ========================================================= */}
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
                  Comparte una palabra de fe, reflexión y un versículo bíblico.
                </Text>
              </View>
              <Ionicons name="add-circle" size={24} color="#1E3A8A" />
            </TouchableOpacity>
          )}

          {/* ========================================================= */}
          {/* FEED DE MENSAJES Y REFLEXIONES PASTORALES                 */}
          {/* ========================================================= */}
          <View style={styles.feedHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="chatbubbles" size={18} color="#1E3A8A" />
              <Text style={styles.feedTitle}>Palabra de los Pastores</Text>
            </View>
            <Text style={styles.feedSubtitle}>{visiblePosts.length} mensajes</Text>
          </View>

          {visiblePosts.length === 0 ? (
            <View style={styles.emptyFeedBox}>
              <Ionicons name="book-outline" size={40} color="#94A3B8" />
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
              const isAuthor = currentUser?.id === post.authorId || currentUser?.role === 'senior_pastor';

              // Obtener la red ministerial real del autor (no la red de destino del mensaje)
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
                  {/* Header del Post */}
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
                        onPress={() =>
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
                          )
                        }>
                        <Ionicons name="trash-outline" size={17} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Título y Contenido */}
                  <Text style={styles.postTitleText}>{post.title}</Text>

                  {/* Versículo Bíblico Adjunto (si existe) */}
                  {post.verse && (
                    <View style={styles.verseBox}>
                      <View style={styles.verseHeader}>
                        <Ionicons name="book" size={15} color="#1E3A8A" />
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

                  {/* Mensaje Pastoral */}
                  <Text style={styles.postContentText}>{post.content}</Text>

                  {/* Footer del Post: Botón de Me Gusta */}
                  <View style={styles.postFooter}>
                    <TouchableOpacity
                      style={[styles.likeButton, hasLiked && styles.likeButtonActive]}
                      activeOpacity={0.8}
                      onPress={() => toggleLikePost(post.id)}>
                      <Ionicons
                        name={hasLiked ? 'heart' : 'heart-outline'}
                        size={18}
                        color={hasLiked ? '#DC2626' : '#64748B'}
                      />
                      <Text
                        style={[styles.likeButtonText, hasLiked && styles.likeButtonTextActive]}>
                        {post.likes.length}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* ========================================================= */}
          {/* ACCESOS DIRECTOS RÁPIDOS A MÓDULOS                        */}
          {/* ========================================================= */}
          <Text style={[styles.feedTitle, { marginTop: 24, marginBottom: 12 }]}>
            Gestión y Módulos
          </Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickItem}
              activeOpacity={0.8}
              onPress={() => router.push('/cells' as any)}>
              <View style={[styles.quickItemIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="git-network" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.quickItemTitle}>Células</Text>
              <Text style={styles.quickItemDesc}>Grupos semanales</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              activeOpacity={0.8}
              onPress={() => router.push('/attendance' as any)}>
              <View style={[styles.quickItemIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="analytics" size={20} color="#2563EB" />
              </View>
              <Text style={styles.quickItemTitle}>Asistencia</Text>
              <Text style={styles.quickItemDesc}>Reporte de cultos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              activeOpacity={0.8}
              onPress={() => router.push('/members' as any)}>
              <View style={[styles.quickItemIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="people" size={20} color="#059669" />
              </View>
              <Text style={styles.quickItemTitle}>Directorio</Text>
              <Text style={styles.quickItemDesc}>Equipo & G12</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              activeOpacity={0.8}
              onPress={() => router.push('/planner' as any)}>
              <View style={[styles.quickItemIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="calendar" size={20} color="#D97706" />
              </View>
              <Text style={styles.quickItemTitle}>Eventos</Text>
              <Text style={styles.quickItemDesc}>Órdenes de culto</Text>
            </TouchableOpacity>
          </View>

          {/* Selector de roles demo */}
          <View style={styles.demoSection}>
            <TouchableOpacity
              style={styles.demoToggleHeader}
              activeOpacity={0.8}
              onPress={() => setShowDemoSelector((v) => !v)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="flask-outline" size={15} color="#64748B" />
                <Text style={styles.demoToggleText}>Probar otros roles (Demo rápido)</Text>
              </View>
              <Ionicons
                name={showDemoSelector ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#64748B"
              />
            </TouchableOpacity>

            {showDemoSelector && (
              <View style={styles.demoRolesGrid}>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => quickDemoLogin('pastor_jose')}>
                  <Text style={styles.demoPillText}>Pastor José (Principal)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => quickDemoLogin('pastora_neidy')}>
                  <Text style={styles.demoPillText}>Pastora Neidy (Principal)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => quickDemoLogin('pastor_josue')}>
                  <Text style={styles.demoPillText}>Pastor Josué (Juvenil)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => quickDemoLogin('pastor_carlos')}>
                  <Text style={styles.demoPillText}>Pastor Carlos (Adultos)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoPill}
                  onPress={() => quickDemoLogin('lider_yonmar')}>
                  <Text style={styles.demoPillText}>Líder Yonmar (G12)</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>

      {/* ========================================================= */}
      {/* MODAL: ESCRIBIR MENSAJE PASTORAL CON BIBLE API            */}
      {/* ========================================================= */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="create" size={22} color="#1E3A8A" />
                <Text style={styles.modalTitle}>Publicar Mensaje Pastoral</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* Título del Mensaje */}
              <Text style={styles.modalInputLabel}>Título de la Reflexión / Mensaje</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="ej: Nuestra fuerza viene del Señor"
                placeholderTextColor="#94A3B8"
                value={postTitle}
                onChangeText={setPostTitle}
              />

              {/* Destino / Red */}
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

              {/* SECCIÓN DE BIBLE API: ADJUNTAR VERSÍCULO */}
              <View style={styles.bibleApiSection}>
                <View style={styles.bibleApiHeader}>
                  <Ionicons name="book" size={16} color="#1E3A8A" />
                  <Text style={styles.bibleApiTitle}>Adjuntar Versículo (Biblia en Español RVR1960)</Text>
                </View>
                <Text style={styles.bibleApiDesc}>
                  Escribe la cita (sin importar acentos, con espacio o dos puntos, versículo solo o rango como josue 1 9 o josue 1 9-10):
                </Text>

                {/* Buscador de Versículo */}
                <View style={styles.verseSearchRow}>
                  <TextInput
                    style={styles.verseSearchInput}
                    placeholder="ej: josue 1 9, josue 1 9-10, juan 3:16"
                    placeholderTextColor="#94A3B8"
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

                {/* Versículos Sugeridos Rápidos */}
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

                {/* Vista previa del versículo seleccionado */}
                {selectedVerse && (
                  <View style={styles.selectedVersePreview}>
                    <View style={styles.versePreviewHeader}>
                      <Text style={styles.versePreviewRef}>{selectedVerse.reference}</Text>
                      <TouchableOpacity onPress={() => setSelectedVerse(null)}>
                        <Ionicons name="close" size={18} color="#EF4444" />
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
                    <Text style={styles.verseEditHint}>
                      * Puedes retocar o ajustar el texto del versículo libremente.
                    </Text>
                  </View>
                )}
              </View>

              {/* Contenido / Palabra Pastoral */}
              <Text style={styles.modalInputLabel}>Mensaje Pastoral / Reflexión</Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextArea]}
                placeholder="Escribe tu mensaje para edificar a la congregación..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={6}
                value={postContent}
                onChangeText={setPostContent}
              />

              {/* Botón Publicar */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  heroBanner: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  churchBadgeText: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  logoutPillText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  userProfileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#93C5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  userGreeting: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userFullName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  userBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  networkBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  networkBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  compactEventPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  compactEventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactEventTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  compactEventRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactEventDate: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  createPostBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  createPostIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  createPostSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  feedSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyFeedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyFeedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
  },
  emptyFeedDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  postAuthorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAuthorAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  postAuthorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  postRoleBadge: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  postMetaDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  postNetworkTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  postTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  verseBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    marginBottom: 10,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verseRefText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  verseTransBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verseTransText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E40AF',
  },
  verseBodyText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  postContentText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  likeButtonActive: {
    backgroundColor: '#FEE2E2',
  },
  likeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  likeButtonTextActive: {
    color: '#DC2626',
  },
  likesCountNote: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  quickItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickItemDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  demoSection: {
    marginTop: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  demoRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  demoPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  demoPillText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
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
    color: '#0F172A',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  networkOptionBtnActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  networkOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  networkOptionTextActive: {
    color: '#FFFFFF',
  },
  bibleApiSection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1E3A8A',
  },
  bibleApiDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  verseSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verseSearchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  verseSearchBtn: {
    backgroundColor: '#2563EB',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  quickVerseChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  quickVerseChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  quickVerseChipTextActive: {
    color: '#1E40AF',
    fontWeight: '800',
  },
  verseFeedbackText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 4,
  },
  selectedVersePreview: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
    color: '#1E40AF',
  },
  verseEditText: {
    fontSize: 12,
    color: '#1E293B',
    fontStyle: 'italic',
    lineHeight: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  verseEditHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
  },
  publishSubmitBtn: {
    backgroundColor: '#1E3A8A',
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
});
