/**
 * VirusTotal Service - Domain/URL Security Scanning
 *
 * Integrates with VirusTotal API to scan domains and URLs for phishing,
 * malware, and other security threats.
 *
 * VirusTotal API Docs: https://developers.virustotal.com/reference/overview
 */

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const VIRUSTOTAL_TIMEOUT = 15000; // 15 seconds

export interface VirusTotalResult {
  verdict: 'clean' | 'malicious' | 'suspicious' | 'unknown';
  positives: number;
  total: number;
  engines: Array<{ name: string; detected: boolean; result?: string }>;
  scanUrl: string;
  topEngines?: string[];
}

interface VTAnalysisStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
}

interface VTEngineResult {
  category: 'malicious' | 'suspicious' | 'harmless' | 'undetected';
  result?: string;
  method: string;
  engine_name: string;
}

interface VTDomainResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      last_analysis_stats: VTAnalysisStats;
      last_analysis_results: Record<string, VTEngineResult>;
      last_analysis_date?: number;
      reputation?: number;
    };
  };
}

export class VirusTotalService {
  private baseUrl = 'https://www.virustotal.com/api/v3';

  /**
   * Check if VirusTotal service is configured
   */
  isConfigured(): boolean {
    return !!VIRUSTOTAL_API_KEY;
  }

  /**
   * Scan a domain for security threats
   */
  async scanDomain(domain: string): Promise<VirusTotalResult | null> {
    if (!VIRUSTOTAL_API_KEY) {
      console.warn('VirusTotal API key not configured');
      return null;
    }

    // Clean domain (remove protocol, path, etc.)
    const cleanDomain = this.cleanDomain(domain);
    if (!cleanDomain) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/domains/${cleanDomain}`, {
        method: 'GET',
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(VIRUSTOTAL_TIMEOUT),
      });

      if (response.status === 404) {
        // Domain not found in VT database
        return {
          verdict: 'unknown',
          positives: 0,
          total: 0,
          engines: [],
          scanUrl: `https://www.virustotal.com/gui/domain/${cleanDomain}`,
        };
      }

      if (!response.ok) {
        console.error('VirusTotal API error:', response.status, await response.text());
        return null;
      }

      const data = (await response.json()) as VTDomainResponse;
      return this.parseResponse(data, cleanDomain);
    } catch (error) {
      console.error('VirusTotal scan error:', error);
      return null;
    }
  }

  /**
   * Scan a URL for security threats
   */
  async scanUrl(url: string): Promise<VirusTotalResult | null> {
    if (!VIRUSTOTAL_API_KEY) {
      console.warn('VirusTotal API key not configured');
      return null;
    }

    try {
      // URL ID is base64-encoded URL without padding
      const urlId = Buffer.from(url).toString('base64').replace(/=+$/, '');

      const response = await fetch(`${this.baseUrl}/urls/${urlId}`, {
        method: 'GET',
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(VIRUSTOTAL_TIMEOUT),
      });

      if (response.status === 404) {
        // URL not scanned yet, try to extract domain
        const domain = this.extractDomain(url);
        if (domain) {
          return this.scanDomain(domain);
        }
        return null;
      }

      if (!response.ok) {
        console.error('VirusTotal URL scan error:', response.status);
        return null;
      }

      const data = (await response.json()) as VTDomainResponse;
      const domain = this.extractDomain(url) || 'unknown';
      return this.parseResponse(data, domain);
    } catch (error) {
      console.error('VirusTotal URL scan error:', error);
      return null;
    }
  }

  /**
   * Parse VirusTotal API response into our format
   */
  private parseResponse(data: VTDomainResponse, domain: string): VirusTotalResult {
    const stats = data.data.attributes.last_analysis_stats;
    const results = data.data.attributes.last_analysis_results;

    const positives = stats.malicious + stats.suspicious;
    const total = stats.malicious + stats.suspicious + stats.undetected + stats.harmless;

    // Extract engine results
    const engines: Array<{ name: string; detected: boolean; result?: string }> = [];
    const detectingEngines: string[] = [];

    for (const [engineName, result] of Object.entries(results)) {
      const detected = result.category === 'malicious' || result.category === 'suspicious';
      engines.push({
        name: engineName,
        detected,
        result: result.result,
      });

      if (detected) {
        detectingEngines.push(engineName);
      }
    }

    // Determine verdict
    let verdict: VirusTotalResult['verdict'];
    if (positives === 0) {
      verdict = 'clean';
    } else if (stats.malicious >= 3 || positives >= 5) {
      verdict = 'malicious';
    } else if (positives >= 1) {
      verdict = 'suspicious';
    } else {
      verdict = 'unknown';
    }

    // Get top detecting engines (limit to 5)
    const topEngines = detectingEngines.slice(0, 5);

    return {
      verdict,
      positives,
      total,
      engines,
      scanUrl: `https://www.virustotal.com/gui/domain/${domain}`,
      topEngines: topEngines.length > 0 ? topEngines : undefined,
    };
  }

  /**
   * Clean and validate domain string
   */
  private cleanDomain(input: string): string | null {
    try {
      // Remove protocol if present
      let domain = input.replace(/^https?:\/\//i, '');
      // Remove path
      domain = domain.split('/')[0] || '';
      // Remove port
      domain = domain.split(':')[0] || '';
      // Remove www prefix
      domain = domain.replace(/^www\./i, '');
      // Validate basic domain format
      if (domain && /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/.test(domain)) {
        return domain.toLowerCase();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./i, '');
    } catch {
      return this.cleanDomain(url);
    }
  }
}
