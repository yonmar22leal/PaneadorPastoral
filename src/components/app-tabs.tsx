import { useChurch } from '@/context/ChurchContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabBarIconProps = {
  focused: boolean;
  color: any;
  size: number;
};

const renderHomeIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="home" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const renderCellsIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="git-network" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const renderPastorAttendanceIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="calculator" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const renderLeaderAttendanceIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons
    name="checkmark-done-circle"
    size={size}
    color={typeof color === 'string' ? color : '#38BDF8'}
  />
);

const renderPastorMembersIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="people" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const renderPlannerIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="calendar" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const renderKidsIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="happy" size={size} color={typeof color === 'string' ? color : '#38BDF8'} />
);

const HIDDEN_BAR_OPTIONS = {
  tabBarItemStyle: { display: 'none' as const },
  tabBarStyle: { display: 'none' as const },
};
const HIDDEN_OPTIONS = { href: null };
const CELLS_OPTIONS = { title: 'Células', tabBarIcon: renderCellsIcon };
const KIDS_OPTIONS = { title: 'Niños', href: null, tabBarIcon: renderKidsIcon };

export default function AppTabs() {
  const { currentUser } = useChurch();
  const insets = useSafeAreaInsets();
  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 24 : 10);
  const barHeight = 56 + bottomInset;

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: 'none' as const,
      tabBarActiveTintColor: '#38BDF8',
      tabBarInactiveTintColor: '#64748B',
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600' as const,
        marginTop: 2,
      },
      tabBarItemStyle: {
        paddingTop: 4,
      },
      tabBarBackground: () => (
        <BlurView
          tint="dark"
          intensity={Platform.OS === 'ios' ? 65 : 85}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                Platform.OS === 'android'
                  ? 'rgba(7, 10, 20, 0.78)'
                  : 'rgba(7, 10, 20, 0.65)',
            },
          ]}
        />
      ),
      tabBarStyle: !currentUser
        ? { display: 'none' as const }
        : {
            position: 'absolute' as const,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'transparent',
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            borderTopWidth: 1,
            elevation: 0,
            height: barHeight,
            paddingBottom: bottomInset,
            paddingTop: 6,
          },
    }),
    [currentUser, barHeight, bottomInset]
  );

  const indexOptions = useMemo(
    () => ({
      title: isPastor ? 'Inicio' : 'Mi Panel',
      tabBarIcon: renderHomeIcon,
    }),
    [isPastor]
  );

  const attendanceOptions = useMemo(
    () => ({
      title: isPastor ? 'Asistencia' : 'Reportar',
      tabBarIcon: isPastor ? renderPastorAttendanceIcon : renderLeaderAttendanceIcon,
    }),
    [isPastor]
  );

  const membersOptions = useMemo(
    () => ({
      title: isPastor ? 'Directorio' : 'Mi equipo',
      tabBarIcon: renderPastorMembersIcon,
    }),
    [isPastor]
  );

  const plannerOptions = useMemo(
    () => ({
      title: isPastor ? 'Eventos' : 'Cronograma',
      tabBarIcon: renderPlannerIcon,
    }),
    [isPastor]
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={indexOptions} />
      <Tabs.Screen name="cells" options={CELLS_OPTIONS} />
      <Tabs.Screen name="attendance" options={attendanceOptions} />
      <Tabs.Screen name="members" options={membersOptions} />
      <Tabs.Screen name="planner" options={plannerOptions} />
      <Tabs.Screen name="kids" options={KIDS_OPTIONS} />
      <Tabs.Screen name="login" options={HIDDEN_BAR_OPTIONS} />
      <Tabs.Screen name="register" options={HIDDEN_BAR_OPTIONS} />
      <Tabs.Screen name="profile" options={HIDDEN_BAR_OPTIONS} />
      <Tabs.Screen name="ministries" options={HIDDEN_OPTIONS} />
    </Tabs>
  );
}
