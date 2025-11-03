import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TenorGif {
  id: string;
  media_formats: {
    gif: {
      url: string;
    };
    tinygif: {
      url: string;
    };
  };
  content_description: string;
}

interface TenorResponse {
  results: TenorGif[];
}

@Injectable()
export class TenorService {
  private readonly apiKey: string;
  private readonly clientKey = 'commhub';
  private readonly baseUrl = 'https://tenor.googleapis.com/v2';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TENOR_API_KEY');
    if (!this.apiKey) {
      throw new Error('TENOR_API_KEY environment variable is not set');
    }
  }

  async getTrendingGifs(limit: number = 20): Promise<TenorGif[]> {
    try {
      const url = `${this.baseUrl}/featured?key=${this.apiKey}&client_key=${this.clientKey}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new HttpException(
          `Tenor API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: TenorResponse = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching trending gifs:', error);
      throw new HttpException(
        'Failed to fetch trending GIFs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async searchGifs(query: string, limit: number = 20): Promise<TenorGif[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/search?q=${encodedQuery}&key=${this.apiKey}&client_key=${this.clientKey}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new HttpException(
          `Tenor API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: TenorResponse = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching gifs:', error);
      throw new HttpException(
        'Failed to search GIFs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
