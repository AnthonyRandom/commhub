import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

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

  constructor() {
    this.apiKey = process.env.TENOR_API_KEY;
    if (!this.apiKey) {
      throw new Error('TENOR_API_KEY environment variable is not set');
    }
  }

  async getTrendingGifs(
    limit: number = 50,
    pos?: string
  ): Promise<{ results: TenorGif[]; next: string }> {
    try {
      let url = `${this.baseUrl}/featured?key=${this.apiKey}&client_key=${this.clientKey}&limit=${limit}`;
      if (pos) {
        url += `&pos=${pos}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new HttpException(
          `Tenor API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: any = await response.json();
      return {
        results: data.results || [],
        next: data.next || '',
      };
    } catch (error) {
      console.error('Error fetching trending gifs:', error);
      throw new HttpException(
        'Failed to fetch trending GIFs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async searchGifs(
    query: string,
    limit: number = 50,
    pos?: string
  ): Promise<{ results: TenorGif[]; next: string }> {
    try {
      const encodedQuery = encodeURIComponent(query);
      let url = `${this.baseUrl}/search?q=${encodedQuery}&key=${this.apiKey}&client_key=${this.clientKey}&limit=${limit}`;
      if (pos) {
        url += `&pos=${pos}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new HttpException(
          `Tenor API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY
        );
      }

      const data: any = await response.json();
      return {
        results: data.results || [],
        next: data.next || '',
      };
    } catch (error) {
      console.error('Error searching gifs:', error);
      throw new HttpException(
        'Failed to search GIFs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
