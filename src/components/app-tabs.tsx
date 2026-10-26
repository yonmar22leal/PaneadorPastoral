import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Colors } from '@/constants/theme';
import { useChurch } from '@/context/ChurchContext';

type TabBarIconProps = {
  focused: boolean;
  color: any;
  size: number;
};

const renderHomeIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="home" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const renderCellsIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="git-network" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const renderPastorAttendanceIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="calculator" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const renderLeaderAttendanceIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons
    name="checkmark-done-circle"
    size={size}
    color={typeof color === 'string' ? color : '#1E3A8A'}
  />
);

const renderPastorMembersIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="people" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const renderPlannerIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="calendar" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const renderKidsIcon = ({ color, size }: TabBarIconProps) => (
  <Ionicons name="happy" size={size} color={typeof color === 'string' ? color : '#1E3A8A'} />
);

const HIDDEN_BAR_OPTIONS = { href: null, tabBarStyle: { display: 'none' as const } };
const HIDDEN_OPTIONS = { href: null };
const CELLS_OPTIONS = { title: 'Células', tabBarIcon: renderCellsIcon };
const KIDS_OPTIONS = { title: 'Niños', href: null, tabBarIcon: renderKidsIcon };

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { currentUser } = useChurch();
  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: 'none' as const,
      tabBarActiveTintColor: '#1E3A8A',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: !currentUser
        ? { display: 'none' as const }
        : {
            backgroundColor: colors.background,
            borderTopColor: colors.backgroundElement,
          },
    }),
    [currentUser, colors.background, colors.backgroundElement]
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
      title: isPastor ? 'Directorio' : 'Mis 12',
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
      <Tabs.Screen name="ministries" options={HIDDEN_OPTIONS} />
    </Tabs>
  );
}
