import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
  Animated,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import api from './api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Sallama eşik değeri
const SHAKE_THRESHOLD = 2;
const SHAKE_TIMEOUT = 1000; // 1 saniyede bir sallama algıla

// ==================== ANA UYGULAMA ====================
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const userJson = await AsyncStorage.getItem('userData');
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserData(user);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error('Login check error:', error);
    }
  };

  const handleLogin = async (email, password) => {
    const result = await api.login(email, password);
    if (result.success) {
      const user = {
        email,
        token: result.token,
        userId: result.user_id,
        name: result.name,
        surname: result.surname,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      setUserData(user);
      setIsLoggedIn(true);
    }
    return result;
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userData');
    setUserData(null);
    setIsLoggedIn(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      {isLoggedIn ? (
        <JobEntryScreen userData={userData} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </View>
  );
}

// ==================== LOGIN EKRANI ====================
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Son kullanılan email'i yükle
  useEffect(() => {
    loadLastEmail();
  }, []);

  const loadLastEmail = async () => {
    try {
      const lastEmail = await AsyncStorage.getItem('lastEmail');
      if (lastEmail) {
        setEmail(lastEmail);
      }
    } catch (error) {
      console.log('Son email yüklenemedi:', error);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Email ve şifre giriniz');
      return;
    }

    setLoading(true);
    const result = await onLogin(email, password);
    // Başarılı girişte email'i kaydet
    if (result.success) {
      await AsyncStorage.setItem('lastEmail', email);
    }
    setLoading(false);

    if (!result.success) {
      Alert.alert('Giriş Başarısız', result.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView 
        contentContainerStyle={styles.loginScrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginContainer}>
          <View style={styles.loginBox}>
            <Text style={styles.loginTitle}>🔐 KDM</Text>
            <Text style={styles.loginSubtitle}>İş Kayıtları</Text>

            <TextInput
              style={styles.input}
              placeholder="Email adresiniz"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Şifreniz"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==================== İŞ KAYIT EKRANI ====================
function JobEntryScreen({ userData, onLogout }) {
  const [jobDefinitions, setJobDefinitions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [planningModalVisible, setPlanningModalVisible] = useState(false);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);
  
  // Salla özelliği state'leri
  const [shakeModalVisible, setShakeModalVisible] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const lastShakeTime = useRef(0);
  const subscription = useRef(null);
  const shakeCountRef = useRef(0); // Ref ile takip et

  useEffect(() => {
    loadJobDefinitions();
  }, []);

  useEffect(() => {
    const loadDayData = async () => {
      initializeDayEntries();
      setTimeout(() => loadExistingRecords(), 100);
    };
    loadDayData();
  }, [selectedDate]);

  function getToday() {
    return new Date().toISOString().split('T')[0];
  }

  const loadJobDefinitions = async () => {
    setLoading(true);
    const myJobs = await api.getMyJobs(userData.token, userData.userId);
    if (myJobs && myJobs.length > 0) {
      setJobDefinitions(myJobs);
    } else {
      const defaultJobs = await api.getJobDefinitions();
      setJobDefinitions(defaultJobs);
    }
    setLoading(false);
  };

  const loadExistingRecords = async () => {
    try {
      const history = await api.getTaskHistory(userData.token, userData.userId, 100);
      if (history && history.length > 0) {
        const dateRecords = history.filter(record => {
          const recordDate = record.start_time.split('T')[0];
          return recordDate === selectedDate;
        });

        if (dateRecords.length > 0) {
          setEntries(prevEntries => {
            const newEntries = [...prevEntries];
            dateRecords.forEach(record => {
              const startTime = record.start_time.split('T')[1].substring(0, 5);
              const entryIndex = newEntries.findIndex(e => e.startTime === startTime);
              
              if (entryIndex !== -1) {
                if (record.status_id === 'DayOff') {
                  newEntries[entryIndex] = {
                    ...newEntries[entryIndex],
                    isDayOff: true,
                    isPlanned: false,
                    existingId: record.id,
                    description: 'İzin Günü',
                  };
                } else if (record.status_id === 'Planned') {
                  newEntries[entryIndex] = {
                    ...newEntries[entryIndex],
                    jobId: record.job_definition_id,
                    isPlanned: true,
                    isDayOff: false,
                    existingId: record.id,
                    description: record.job_name || 'Planlanan İş',
                  };
                } else {
                  newEntries[entryIndex] = {
                    ...newEntries[entryIndex],
                    jobId: record.job_definition_id,
                    isPlanned: false,
                    isDayOff: false,
                    existingId: record.id,
                    description: record.description || record.job_name || 'Rutin işlemleri',
                  };
                }
              }
            });
            return newEntries;
          });
        }
      }
    } catch (error) {
      console.log('Mevcut kayıtlar çekilemedi:', error);
    }
  };

  const initializeDayEntries = () => {
    const entries = [];
    const startHour = 8, startMinute = 30, endHour = 17, endMinute = 30;
    let currentHour = startHour, currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      if (!(currentHour === 12 && currentMinute >= 30) && !(currentHour === 13 && currentMinute < 30)) {
        const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        currentMinute += 30;
        if (currentMinute >= 60) { currentHour += 1; currentMinute -= 60; }
        const endTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        
        entries.push({
          id: entries.length, startTime, endTime,
          jobId: null, description: '',
          isDayOff: false, isPlanned: false,
          existingId: null,
        });
      } else {
        currentMinute += 30;
        if (currentMinute >= 60) { currentHour += 1; currentMinute -= 60; }
      }
    }
    setEntries(entries);
  };

  // ==================== SALLA ÖZELLİĞİ ====================
  
  // Accelerometer'ı başlat
  const startAccelerometer = async () => {
    try {
      // İzin iste (iOS için gerekli)
      if (Platform.OS === 'ios') {
        const { status } = await Accelerometer.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Sallama özelliği için sensör izni gerekiyor.');
          return;
        }
      }
      
      // Accelerometer'ı başlat
      Accelerometer.setUpdateInterval(100); // 100ms güncelleme aralığı
      
      subscription.current = Accelerometer.addListener(accelerometerData => {
        detectShake(accelerometerData);
      });
      
      setIsShaking(true);
      shakeCountRef.current = 0;
      setShakeCount(0);
      
      // Animasyonu başlat
      startShakeAnimation();
      
    } catch (error) {
      console.error('Accelerometer hatası:', error);
      Alert.alert('Hata', 'Sallama sensörü başlatılamadı.');
    }
  };

  // Accelerometer'ı durdur
  const stopAccelerometer = () => {
    if (subscription.current) {
      subscription.current.remove();
      subscription.current = null;
    }
    setIsShaking(false);
    shakeAnimation.setValue(0);
  };

  // Sallamayı algıla
  const detectShake = (data) => {
    const { x, y, z } = data;
    const acceleration = Math.sqrt(x * x + y * y + z * z);
    
    const now = Date.now();
    
    if (acceleration > SHAKE_THRESHOLD && now - lastShakeTime.current > SHAKE_TIMEOUT) {
      lastShakeTime.current = now;
      shakeCountRef.current += 1;
      setShakeCount(shakeCountRef.current);
      Vibration.vibrate(50); // Hafif titreşim
      
      // 2 sallama sonrası otomatik doldur
      if (shakeCountRef.current >= 2) {
        performShakeFill();
      }
    }
  };

  // Sallama animasyonu
  const startShakeAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Sallama ile otomatik doldur
  const performShakeFill = () => {
    stopAccelerometer();
    setShakeModalVisible(false);
    
    // Boş slotları bul
    const emptyIndices = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !entry.jobId && !entry.isDayOff && !entry.isPlanned && !entry.existingId);
    
    if (emptyIndices.length === 0) {
      Alert.alert('Bilgi', 'Doldurulacak boş slot yok!');
      return;
    }
    
    // Rastgele iş sayısı belirle (boş slotların %40-80'i)
    const minJobs = Math.ceil(emptyIndices.length * 0.4);
    const maxJobs = Math.ceil(emptyIndices.length * 0.8);
    const jobCount = Math.floor(Math.random() * (maxJobs - minJobs + 1)) + minJobs;
    
    // Rastgele slotları seç
    const shuffled = [...emptyIndices].sort(() => Math.random() - 0.5);
    const selectedSlots = shuffled.slice(0, jobCount);
    
    // Rastgele iş ata
    const newEntries = [...entries];
    selectedSlots.forEach(({ index }) => {
      const randomJobIndex = Math.floor(Math.random() * jobDefinitions.length);
      const job = jobDefinitions[randomJobIndex];
      
      if (job) {
        newEntries[index] = {
          ...newEntries[index],
          jobId: job.id,
          isDayOff: false,
          isPlanned: false,
          existingId: null,
          description: `Rutin ${job.name} işlemleri`,
        };
      }
    });
    
    setEntries(newEntries);
    Vibration.vibrate([0, 100, 50, 100]); // Başarı titreşimi
    Alert.alert('🎉 Sallama Tamamlandı!', `${selectedSlots.length} adet iş kaydı otomatik dolduruldu.`);
  };

  // Salla modalını aç
  const openShakeModal = () => {
    if (jobDefinitions.length === 0) {
      Alert.alert('Hata', 'Önce iş tanımları yüklenmeli!');
      return;
    }
    setShakeModalVisible(true);
    startAccelerometer();
  };

  // Component unmount olduğunda temizlik
  useEffect(() => {
    return () => {
      stopAccelerometer();
    };
  }, []);

  const updateEntry = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    if (field === 'jobId' && value) {
      const job = jobDefinitions.find(j => j.id === value);
      if (job) newEntries[index].description = `Rutin ${job.name} işlemleri`;
      newEntries[index].isDayOff = false;
      newEntries[index].isPlanned = false;
      newEntries[index].existingId = null;
    }
    setEntries(newEntries);
  };

  const clearEntry = async (index) => {
    const entry = entries[index];
    if (entry.existingId) {
      Alert.alert(
        'Kaydı Sil',
        `${entry.startTime} saatlerindeki kaydı silmek istiyor musunuz?`,
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Sil', style: 'destructive',
            onPress: async () => {
              const result = await api.deleteRecord(userData.token, entry.existingId);
              if (result.success) {
                const newEntries = [...entries];
                newEntries[index] = { ...newEntries[index], jobId: null, isDayOff: false, isPlanned: false, description: '', existingId: null };
                setEntries(newEntries);
                Alert.alert('Başarılı', 'Kayıt silindi');
              }
            }
          }
        ]
      );
    } else {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], jobId: null, isDayOff: false, isPlanned: false, description: '', existingId: null };
      setEntries(newEntries);
    }
  };

  const openPlanningSelector = (index) => {
    setSelectedEntryIndex(index);
    setPlanningModalVisible(true);
  };

  const selectPlanningJob = (jobId) => {
    if (selectedEntryIndex !== null) {
      const job = jobDefinitions.find(j => j.id === jobId);
      const newEntries = [...entries];
      newEntries[selectedEntryIndex] = {
        ...newEntries[selectedEntryIndex],
        isPlanned: true, isDayOff: false, jobId: jobId,
        existingId: null,
        description: job ? `Plan: ${job.name}` : 'Planlanan İş',
      };
      setEntries(newEntries);
    }
    setPlanningModalVisible(false);
    setSelectedEntryIndex(null);
  };

  const markDayOffForSlot = (index) => {
    const newEntries = [...entries];
    newEntries[index] = {
      ...newEntries[index],
      isDayOff: true, isPlanned: false, jobId: null,
      existingId: null, description: 'İzin Günü',
    };
    setEntries(newEntries);
  };

  const handleSubmit = async () => {
    const validEntries = entries.filter(e => (e.jobId || e.isDayOff || e.isPlanned) && !e.existingId);
    if (validEntries.length === 0) {
      Alert.alert('Bilgi', 'Gönderilecek yeni kayıt yok.');
      return;
    }

    setSubmitting(true);
    let successCount = 0, failCount = 0;

    for (const entry of validEntries) {
      try {
        if (entry.isDayOff) {
          const result = await api.submitDayOff(userData.token, userData.userId, selectedDate, entry.startTime, entry.endTime);
          if (result.success) successCount++; else failCount++;
        } else if (entry.isPlanned) {
          const result = await api.submitPlanning(userData.token, userData.userId, selectedDate, entry.startTime, entry.endTime, entry.jobId);
          if (result.success) successCount++; else failCount++;
        } else {
          const job = jobDefinitions.find(j => j.id === entry.jobId);
          const payload = {
            job_definition_id: entry.jobId,
            description: entry.description || `Rutin ${job?.name} işlemleri`,
            start_time: `${selectedDate}T${entry.startTime}:00`,
            end_time: `${selectedDate}T${entry.endTime}:00`,
            hour: 0.5, piece: 0,
          };
          const result = await api.submitJob(userData.token, userData.userId, payload);
          if (result.success) successCount++; else failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setSubmitting(false);
    if (failCount === 0) {
      Alert.alert('Başarılı', `${successCount} kayıt gönderildi`);
      setTimeout(() => { initializeDayEntries(); setTimeout(loadExistingRecords, 100); }, 500);
    } else {
      Alert.alert('Tamamlandı', `${successCount} başarılı, ${failCount} başarısız`);
    }
  };

  const openJobSelector = (index) => {
    setSelectedEntryIndex(index);
    setModalVisible(true);
  };

  const selectJob = (jobId) => {
    if (selectedEntryIndex !== null) updateEntry(selectedEntryIndex, 'jobId', jobId);
    setModalVisible(false);
    setSelectedEntryIndex(null);
  };

  const generateDateOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -7; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const label = i === 0 ? 'Bugün' : i === -1 ? 'Dün' : i === 1 ? 'Yarın' : 
        date.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
      options.push({ value: dateStr, label });
    }
    return options;
  };

  const renderEntryRow = ({ item: entry, index }) => {
    const isDayOff = entry.isDayOff;
    const isPlanned = entry.isPlanned;
    const hasJob = !!entry.jobId || isPlanned;
    const hasExistingRecord = !!entry.existingId;
    const isEmpty = !hasJob && !isDayOff && !isPlanned && !hasExistingRecord;
    
    // İş adını belirle
    let displayText = 'İş seç...';
    if (isDayOff) displayText = '🏖️ İzin Günü';
    else if (isPlanned) displayText = `📅 ${entry.description || 'Planlanan İş'}`;
    else if (hasJob) {
      const job = jobDefinitions.find(j => j.id === entry.jobId);
      displayText = job?.name || 'İş';
    }
    
    return (
      <View style={[
        styles.entryRow,
        isDayOff && styles.dayOffRow,
        isPlanned && styles.plannedRow,
        hasExistingRecord && !isDayOff && !isPlanned && styles.existingRow
      ]}>
        {/* Sol: Saat */}
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{entry.startTime}</Text>
          <Text style={styles.timeTextSmall}>{entry.endTime}</Text>
        </View>
        
        {/* Orta: İş Seçim Alanı */}
        <View style={styles.jobColumn}>
          <TouchableOpacity
            style={[
              styles.jobSelector,
              isDayOff && styles.dayOffSelector,
              isPlanned && styles.plannedSelector
            ]}
            onPress={() => {
              if (hasExistingRecord) {
                Alert.alert('Kayıt Mevcut', 'Değiştirmek istiyor musunuz?', [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Değiştir', onPress: () => openJobSelector(index) }
                ]);
              } else {
                openJobSelector(index);
              }
            }}
          >
            <Text style={[
              hasJob ? styles.selectedJobText : styles.placeholderText,
              isDayOff && styles.dayOffText,
              isPlanned && styles.plannedText
            ]} numberOfLines={1}>
              {displayText}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sağ: Butonlar */}
        <View style={styles.actionButtons}>
          {isEmpty ? (
            <>
              <TouchableOpacity style={[styles.iconBtn, styles.planningBtn]} onPress={() => openPlanningSelector(index)}>
                <Text>📅</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.dayOffBtn]} onPress={() => markDayOffForSlot(index)}>
                <Text>🏖️</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => clearEntry(index)}>
              <Text style={styles.deleteBtnText}>❌</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
      <View style={styles.mainContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>📋 KDM İş Kayıtları</Text>
            <Text style={styles.headerSubtitle}>
              {userData.name && userData.surname ? `${userData.name} ${userData.surname}` : userData.email}
            </Text>
            <View style={styles.jobCountBadge}>
              <Text style={styles.jobCountText}>🏷️ {jobDefinitions.length} İş Tanımı</Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={openShakeModal} style={styles.shakeButton}>
              <Text style={styles.shakeButtonText}>📳 Salla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Çıkış</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadExistingRecords} />}>
          {/* Tarih */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Tarih</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowDateModal(true)}>
              <Text style={styles.dateText}>{selectedDate}</Text>
              <Text>📅</Text>
            </TouchableOpacity>
          </View>

          {/* Liste */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 İş Girişleri</Text>
            <FlatList
              data={entries}
              renderItem={renderEntryRow}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          </View>

          {/* Gönder Butonu */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitButtonText}>
                  📤 Kayıtları Gönder ({entries.filter(e => e.jobId || e.isDayOff || e.isPlanned).length})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* İş Seçim Modalı */}
        <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>İş Seçin ({jobDefinitions.length})</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={jobDefinitions}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalItem} onPress={() => selectJob(item.id)}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
            </View>
          </View>
        </Modal>

        {/* Planlama Modalı */}
        <Modal animationType="slide" transparent visible={planningModalVisible} onRequestClose={() => setPlanningModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Planlama için İş Seçin</Text>
                <TouchableOpacity onPress={() => setPlanningModalVisible(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={jobDefinitions}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalItem} onPress={() => selectPlanningJob(item.id)}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
            </View>
          </View>
        </Modal>

        {/* Tarih Modalı */}
        <Modal animationType="slide" transparent visible={showDateModal} onRequestClose={() => setShowDateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tarih Seçin</Text>
                <TouchableOpacity onPress={() => setShowDateModal(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {generateDateOptions().map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.modalItem, selectedDate === opt.value && styles.selectedItem]}
                    onPress={() => { setSelectedDate(opt.value); setShowDateModal(false); }}
                  >
                    <Text style={selectedDate === opt.value && styles.selectedText}>
                      {opt.label} - {opt.value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Salla Modalı */}
        <Modal animationType="fade" transparent visible={shakeModalVisible} onRequestClose={() => { stopAccelerometer(); setShakeModalVisible(false); }}>
          <View style={styles.shakeModalOverlay}>
            <Animated.View 
              style={[
                styles.shakeModalContent,
                {
                  transform: [{
                    translateX: shakeAnimation.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange: [0, -10, 10, -10, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.shakeIconContainer}>
                <Text style={styles.shakeIcon}>📳</Text>
              </View>
              <Text style={styles.shakeTitle}>Telefonu Sallayın!</Text>
              <Text style={styles.shakeSubtitle}>
                Boş slotları otomatik doldurmak için telefonu 2 kez sallayın.
              </Text>
              <View style={styles.shakeProgress}>
                <Text style={styles.shakeCountText}>
                  {shakeCount >= 2 ? '✅ Tamamlandı!' : `Sallama: ${shakeCount}/2`}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(shakeCount / 2) * 100}%` }]} />
                </View>
              </View>
              <TouchableOpacity 
                style={styles.shakeCancelButton} 
                onPress={() => { stopAccelerometer(); setShakeModalVisible(false); }}
              >
                <Text style={styles.shakeCancelText}>İptal</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardView: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  loginScrollContainer: { flexGrow: 1 },
  loginContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a237e', padding: 20 },
  loginBox: { backgroundColor: '#fff', borderRadius: 16, padding: 30, width: '100%', maxWidth: 400 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#1a237e' },
  loginSubtitle: { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16, backgroundColor: '#fafafa', color: '#333' },
  loginButton: { backgroundColor: '#1a237e', padding: 16, borderRadius: 8, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  mainContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1a237e', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#b0b0ff', fontSize: 12, marginBottom: 4 },
  jobCountBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  jobCountText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  shakeButton: { backgroundColor: '#ff9800', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  shakeButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  logoutButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: '600' },
  scrollView: { flex: 1, padding: 16 },

  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 12, textTransform: 'uppercase' },
  datePicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fafafa' },
  dateText: { fontSize: 16, color: '#333' },

  entryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10, alignItems: 'center' },
  timeColumn: { width: 55, alignItems: 'center' },
  timeText: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  timeTextSmall: { fontSize: 11, color: '#999' },
  jobColumn: { flex: 1, marginLeft: 10 },
  jobSelector: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fafafa', minHeight: 40, justifyContent: 'center' },
  placeholderText: { color: '#999' },
  selectedJobText: { color: '#1a237e', fontWeight: '500' },
  
  actionButtons: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  planningBtn: { backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#ffc107' },
  dayOffBtn: { backgroundColor: '#ffe0b2', borderWidth: 1, borderColor: '#ff9800' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 16 },

  dayOffRow: { backgroundColor: '#fff3e0' },
  dayOffSelector: { backgroundColor: '#ffe0b2', borderColor: '#ff9800' },
  dayOffText: { color: '#e65100', fontWeight: '600' },
  plannedRow: { backgroundColor: '#fffde7' },
  plannedSelector: { backgroundColor: '#fff9c4', borderColor: '#fbc02d' },
  plannedText: { color: '#f57f17', fontWeight: '600' },
  existingRow: { backgroundColor: '#e8f5e9' },

  submitButton: { backgroundColor: '#4caf50', padding: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: SCREEN_HEIGHT * 0.8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 20, color: '#666', padding: 8 },
  modalItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalItemText: { color: '#333', fontSize: 15 },
  selectedItem: { backgroundColor: '#e8eaf6' },
  selectedText: { color: '#1a237e', fontWeight: '600' },

  // Salla Modal Stilleri
  shakeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  shakeModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', width: SCREEN_WIDTH * 0.8, maxWidth: 300 },
  shakeIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff3e0', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  shakeIcon: { fontSize: 48 },
  shakeTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  shakeSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  shakeProgress: { width: '100%', marginBottom: 20 },
  shakeCountText: { fontSize: 16, fontWeight: '600', color: '#ff9800', textAlign: 'center', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#ff9800', borderRadius: 4 },
  shakeCancelButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f5f5f5' },
  shakeCancelText: { color: '#666', fontWeight: '600', fontSize: 14 },
});
