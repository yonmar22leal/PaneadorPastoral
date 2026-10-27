import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';

export default function KidsCheckInScreen() {
  const { kids, classrooms, checkInKid, checkOutKid, addKid } = useChurch();

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeCodeModal, setActiveCodeModal] = useState<{
    childName: string;
    code: string;
  } | null>(null);

  // New Kid Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [newClassId, setNewClassId] = useState(classrooms[0]?.id || 'class-1');
  const [newAllergies, setNewAllergies] = useState('');

  // Filter kids
  const filteredKids = kids.filter((kid) => {
    const matchesClass = selectedClassId === 'all' || kid.classroomId === selectedClassId;
    const fullName = `${kid.firstName} ${kid.lastName}`.toLowerCase();
    const parent = kid.parentName.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(q) || parent.includes(q);
    return matchesClass && matchesSearch;
  });

  const handleCheckIn = (kidId: string, name: string) => {
    const code = checkInKid(kidId);
    setActiveCodeModal({ childName: name, code });
  };

  const handleCheckOut = (kidId: string, name: string, code?: string) => {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`¿El padre o tutor presentó el código de seguridad ${code || ''} para recoger a ${name}?`)
          : true;
      if (confirmed) {
        checkOutKid(kidId);
      }
      return;
    }

    Alert.alert(
      'Confirmar Entrega de Niño',
      `¿El padre o tutor presentó el código de seguridad ${code || ''} para recoger a ${name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Salida',
          style: 'destructive',
          onPress: () => checkOutKid(kidId),
        },
      ]
    );
  };

  const handleSaveNewKid = () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newParentName.trim()) {
      Alert.alert('Faltan Datos', 'Por favor ingresa nombre, apellido y tutor.');
      return;
    }

    addKid({
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      age: parseInt(newAge) || 5,
      classroomId: newClassId,
      parentName: newParentName.trim(),
      parentPhone: newParentPhone.trim(),
      allergies: newAllergies.trim() || 'Ninguna',
    });

    setIsAddModalOpen(false);
    setNewFirstName('');
    setNewLastName('');
    setNewAge('');
    setNewParentName('');
    setNewParentPhone('');
    setNewAllergies('');
  };

  const totalIn = kids.filter((k) => k.isCheckedIn).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <DoodleBackground>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Recepción de Niños</Text>
          <Text style={styles.headerSubtitle}>
            Control de entrada y código de seguridad para entrega
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.8}>
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Nuevo Niño</Text>
        </TouchableOpacity>
      </View>

      {/* Live Counter Pill */}
      <View style={styles.statusPillBar}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.statusPillText}>
            <Text style={{ fontWeight: '800' }}>{totalIn}</Text> niños en aulas
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: '#F1F5F9' }]}>
          <Text style={[styles.statusPillText, { color: '#64748B' }]}>
            {kids.length - totalIn} pendientes de ingreso
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por niño o nombre del padre..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Classroom Filter Chips */}
      <View style={styles.classroomsScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChipsContent}>
          <TouchableOpacity
            style={[
              styles.classChip,
              selectedClassId === 'all' && styles.classChipActive,
            ]}
            onPress={() => setSelectedClassId('all')}>
            <Text
              style={[
                styles.classChipText,
                selectedClassId === 'all' && styles.classChipTextActive,
              ]}>
              Todos ({kids.length})
            </Text>
          </TouchableOpacity>

          {classrooms.map((cls) => {
            const count = kids.filter((k) => k.classroomId === cls.id).length;
            const isSelected = selectedClassId === cls.id;
            return (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.classChip,
                  isSelected && { backgroundColor: cls.color, borderColor: cls.color },
                ]}
                onPress={() => setSelectedClassId(cls.id)}>
                <Text
                  style={[
                    styles.classChipText,
                    isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}>
                  {cls.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Kids List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredKids.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No se encontraron niños</Text>
            <Text style={styles.emptySubtitle}>Intenta con otro filtro o registra a un niño nuevo</Text>
          </View>
        ) : (
          filteredKids.map((kid) => {
            const classroom = classrooms.find((c) => c.id === kid.classroomId);
            const hasAllergy = kid.allergies && kid.allergies.toLowerCase() !== 'ninguna';

            return (
              <View
                key={kid.id}
                style={[
                  styles.kidCard,
                  kid.isCheckedIn && styles.kidCardCheckedIn,
                ]}>
                <View style={styles.kidCardTop}>
                  <View style={styles.kidAvatar}>
                    <Text style={styles.kidAvatarText}>
                      {kid.firstName[0]}
                      {kid.lastName[0]}
                    </Text>
                  </View>

                  <View style={styles.kidInfo}>
                    <View style={styles.kidNameRow}>
                      <Text style={styles.kidName}>
                        {kid.firstName} {kid.lastName}
                      </Text>
                      <Text style={styles.kidAge}>{kid.age} años</Text>
                    </View>

                    <View style={styles.classroomBadgeRow}>
                      <View
                        style={[
                          styles.classroomTag,
                          { backgroundColor: classroom?.color || '#3B82F6' },
                        ]}>
                        <Text style={styles.classroomTagText}>
                          {classroom?.name || 'Aula'} • {classroom?.roomNumber}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.parentsRow}>
                      <Ionicons name="people" size={13} color="#64748B" />
                      <Text style={styles.parentNameText}>{kid.parentName}</Text>
                    </View>
                  </View>
                </View>

                {/* Medical / Allergy Alert */}
                {hasAllergy && (
                  <View style={styles.allergyBanner}>
                    <Ionicons name="warning" size={15} color="#D97706" />
                    <Text style={styles.allergyText}>{kid.allergies}</Text>
                  </View>
                )}

                {/* Check-In Status Bar & Actions */}
                <View style={styles.cardFooter}>
                  {kid.isCheckedIn ? (
                    <View style={styles.checkedInRow}>
                      <View style={styles.codeContainer}>
                        <Ionicons name="shield-checkmark" size={18} color="#059669" />
                        <View>
                          <Text style={styles.codeLabel}>Código Tutor</Text>
                          <Text style={styles.codeValue}>{kid.securityCode}</Text>
                        </View>
                        <Text style={styles.checkInTimeText}>Ingreso: {kid.checkInTime}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.checkOutButton}
                        onPress={() =>
                          handleCheckOut(kid.id, `${kid.firstName} ${kid.lastName}`, kid.securityCode)
                        }>
                        <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                        <Text style={styles.checkOutButtonText}>Salida</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.checkedOutRow}>
                      <Text style={styles.notInText}>No ha ingresado aún</Text>
                      <TouchableOpacity
                        style={styles.checkInButton}
                        onPress={() =>
                          handleCheckIn(kid.id, `${kid.firstName} ${kid.lastName}`)
                        }>
                        <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.checkInButtonText}>Hacer Check-In</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal: Show Generated Security Code */}
      <Modal
        visible={!!activeCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveCodeModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.codeModalCard}>
            <View style={styles.codeIconCircle}>
              <Ionicons name="checkmark-done" size={32} color="#10B981" />
            </View>
            <Text style={styles.codeModalTitle}>¡Check-In Exitoso!</Text>
            <Text style={styles.codeModalChildName}>{activeCodeModal?.childName}</Text>
            <Text style={styles.codeModalPrompt}>
              Entrega este código al padre/tutor. Se requerirá para la entrega del niño:
            </Text>

            <View style={styles.largeCodeBox}>
              <Text style={styles.largeCodeText}>{activeCodeModal?.code}</Text>
            </View>

            <TouchableOpacity
              style={styles.closeCodeModalBtn}
              onPress={() => setActiveCodeModal(null)}>
              <Text style={styles.closeCodeModalBtnText}>Listo / Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Add New Child */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Registrar Nuevo Niño</Text>
            <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer}>
            <Text style={styles.formLabel}>Nombre *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Lucas"
              value={newFirstName}
              onChangeText={setNewFirstName}
            />

            <Text style={styles.formLabel}>Apellido *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Mendoza"
              value={newLastName}
              onChangeText={setNewLastName}
            />

            <Text style={styles.formLabel}>Edad (años) *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: 5"
              keyboardType="numeric"
              value={newAge}
              onChangeText={setNewAge}
            />

            <Text style={styles.formLabel}>Aula Asignada</Text>
            <View style={styles.classroomSelectRow}>
              {classrooms.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.classOptionBtn,
                    newClassId === c.id && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => setNewClassId(c.id)}>
                  <Text
                    style={[
                      styles.classOptionBtnText,
                      newClassId === c.id && { color: '#FFFFFF', fontWeight: '700' },
                    ]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Padres o Tutores Responsables *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Juan Mendoza & María Ruiz"
              value={newParentName}
              onChangeText={setNewParentName}
            />

            <Text style={styles.formLabel}>Teléfono de Contacto</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: +1 555-0123"
              keyboardType="phone-pad"
              value={newParentPhone}
              onChangeText={setNewParentPhone}
            />

            <Text style={styles.formLabel}>Alergias o Cuidados Especiales</Text>
            <TextInput
              style={[styles.formInput, { height: 70 }]}
              placeholder="Ej: Alérgico al huevo, asma, etc."
              multiline
              value={newAllergies}
              onChangeText={setNewAllergies}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSaveNewKid}>
              <Text style={styles.submitButtonText}>Guardar Niño en Iglesia Infantil</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  statusPillBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginVertical: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    color: '#065F46',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  classroomsScroll: {
    marginTop: 12,
  },
  classChipsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  classChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  classChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  kidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kidCardCheckedIn: {
    borderColor: '#86EFAC',
    backgroundColor: '#FAFDF9',
  },
  kidCardTop: {
    flexDirection: 'row',
    gap: 14,
  },
  kidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kidAvatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  kidInfo: {
    flex: 1,
  },
  kidNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kidName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  kidAge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  classroomBadgeRow: {
    marginTop: 4,
    flexDirection: 'row',
  },
  classroomTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classroomTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  parentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  parentNameText: {
    fontSize: 12,
    color: '#64748B',
  },
  allergyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  allergyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  checkedInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  checkInTimeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 8,
  },
  checkOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  checkOutButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  checkedOutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notInText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  codeModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  codeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  codeModalChildName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
    marginTop: 4,
  },
  codeModalPrompt: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  largeCodeBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginVertical: 18,
  },
  largeCodeText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1E1B4B',
    letterSpacing: 2,
  },
  closeCodeModalBtn: {
    backgroundColor: '#0F172A',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeCodeModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  classroomSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  classOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  classOptionBtnText: {
    fontSize: 12,
    color: '#475569',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
