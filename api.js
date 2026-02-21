// API Servisi - Doğrudan SHGM API'ye bağlanır

const SHGM_BASE_URL = 'https://kdmorg.shgm.gov.tr/api';

class ApiService {
  constructor() {
    this.baseUrl = SHGM_BASE_URL;
    console.log('[API] SHGM URL:', this.baseUrl);
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[API] Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'api-version': '1.0',
        'language': 'tr',
        ...options.headers,
      };

      // Token varsa ekle
      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      console.log(`[API] Response status: ${response.status}`);
      
      if (response.status === 204) {
        return { success: true };
      }
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      
      // Başarılı yanıtlarda success flag ekle
      if (response.status >= 200 && response.status < 300) {
        return { success: true, ...data };
      }
      
      return data;
    } catch (error) {
      console.error(`[API] Error:`, error.message);
      throw error;
    }
  }

  // Giriş yap ve token al
  async login(email, password) {
    try {
      // 1. Authenticate
      const authData = await this.makeRequest('/Authenticate', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const token = authData.token || authData.accessToken || 
                   (authData.result && authData.result.accessToken);

      if (!token) {
        return { success: false, message: 'Token alınamadı' };
      }

      // 2. Kullanıcı bilgilerini al
      const userData = await this.makeRequest('/LoginUser', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      return {
        success: true,
        token: token,
        user_id: userData.id,
        name: userData.name,
        surname: userData.surname,
        email: userData.email,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Kullanıcının iş tanımlarını çek
  async getMyJobs(token, userId) {
    try {
      const data = await this.makeRequest(
        `/UserJobDefinition/GetMyTask(userId=${userId})?$orderby=startTime desc&$top=100&$select=jobDefinitionId&$expand=jobDefinition($select=name)`,
        { token }
      );

      const tasks = data.value || [];
      const seenIds = new Set();
      const uniqueJobs = [];

      for (const task of tasks) {
        const jobDefId = task.jobDefinitionId;
        const jobDef = task.jobDefinition;
        
        if (jobDefId && !seenIds.has(jobDefId) && jobDef) {
          seenIds.add(jobDefId);
          uniqueJobs.push({
            id: jobDefId,
            name: jobDef.name?.length > 60 ? jobDef.name.substring(0, 57) + '...' : jobDef.name
          });
        }
      }
      
      return uniqueJobs.sort((a, b) => a.id - b.id);
    } catch (error) {
      console.error('My jobs error:', error);
      return [];
    }
  }

  // İş kaydı gönder
  async submitJob(token, userId, job) {
    try {
      const payload = {
        dataStatus: "Activated",
        hour: job.hour || 0.5,
        piece: job.piece || 0,
        otherPositionJob: false,
        userId: userId,
        statusId: "Completed",
        jobDefinitionId: job.job_definition_id,
        description: job.description,
        startTime: job.start_time.endsWith('Z') ? job.start_time : job.start_time + 'Z',
        endTime: job.end_time.endsWith('Z') ? job.end_time : job.end_time + 'Z',
      };

      console.log('[submitJob] Payload:', JSON.stringify(payload));

      return await this.makeRequest('/UserJobDefinition', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('[submitJob] Error:', error.message);
      return { success: false, message: error.message };
    }
  }

  // İzin günü gönder
  async submitDayOff(token, userId, date, startTime, endTime) {
    try {
      const payload = {
        dataStatus: "Activated",
        hour: 0.5,
        piece: 0,
        otherPositionJob: false,
        userId: userId,
        statusId: "DayOff",
        jobDefinitionId: null,
        description: null,
        startTime: `${date}T${startTime}:00Z`,
        endTime: `${date}T${endTime}:00Z`,
      };

      console.log('[submitDayOff] Payload:', JSON.stringify(payload));

      return await this.makeRequest('/UserJobDefinition', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('[submitDayOff] Error:', error.message);
      return { success: false, message: error.message };
    }
  }

  // İş planlama gönder
  async submitPlanning(token, userId, date, startTime, endTime, jobDefinitionId = null) {
    try {
      const payload = {
        dataStatus: "Activated",
        hour: 0.5,
        piece: 0,
        otherPositionJob: false,
        userId: userId,
        statusId: "Planned",
        jobDefinitionId: jobDefinitionId,
        description: null,
        startTime: `${date}T${startTime}:00Z`,
        endTime: `${date}T${endTime}:00Z`,
      };

      console.log('[submitPlanning] Payload:', JSON.stringify(payload));

      return await this.makeRequest('/UserJobDefinition', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('[submitPlanning] Error:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Kayıt sil
  async deleteRecord(token, recordId) {
    try {
      await this.makeRequest(`/UserJobDefinition/${recordId}`, {
        method: 'DELETE',
        token,
      });
      return { success: true, message: 'Silindi' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Geçmiş kayıtları getir
  async getTaskHistory(token, userId, top = 50) {
    try {
      const data = await this.makeRequest(
        `/UserJobDefinition/GetMyTask(userId=${userId})?$orderby=startTime desc&$select=id,jobDefinitionId,statusId,description,startTime,endTime,hour,color&$expand=jobDefinition($select=name)&$top=${top}`,
        { token }
      );

      return (data.value || []).map(t => ({
        id: t.id,
        start_time: t.startTime,
        end_time: t.endTime,
        hour: t.hour,
        description: t.description,
        status_id: t.statusId,
        job_definition_id: t.jobDefinitionId,
        job_name: t.jobDefinition?.name,
        color: t.color,
      }));
    } catch (error) {
      console.error('Task history error:', error);
      return [];
    }
  }

  // Varsayılan iş listesi (fallback)
  async getJobDefinitions() {
    return [
      { id: 108411, name: "Linux Sunucu Kurulumu" },
      { id: 108413, name: "Linux Sunucu Konfigürasyonu" },
      { id: 108415, name: "Linux Sunucu Bakımı" },
      { id: 108417, name: "Linux Sunucu Arıza Çözme" },
      { id: 108427, name: "OS/Middleware Kurulumu" },
      { id: 108429, name: "OS/Middleware Konfigürasyonu" },
      { id: 108431, name: "OS/Middleware Bakımı" },
      { id: 108455, name: "OS/Middleware Arıza Çözme" },
      { id: 108419, name: "Sanallaştırma Kurulumu" },
      { id: 108423, name: "Sanallaştırma Bakımı" },
      { id: 108425, name: "Sanallaştırma Arıza Çözme" },
      { id: 108433, name: "DNS/LDAP/E-posta Kurulumu" },
      { id: 108435, name: "DNS/LDAP/E-posta Konfigürasyonu" },
      { id: 108439, name: "DNS/LDAP/E-posta Bakımı" },
      { id: 108441, name: "DNS/LDAP/E-posta Arıza Çözme" },
      { id: 108443, name: "LB Yapılandırma" },
      { id: 108447, name: "LB Arıza Çözme" },
    ];
  }
}

export default new ApiService();
