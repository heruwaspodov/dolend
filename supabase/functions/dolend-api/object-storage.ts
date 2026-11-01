import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageProvider = 'supabase' | 's3';
export type StoredObjectInput = { bytes: Uint8Array; contentType: 'image/png' | 'image/jpeg' };

export interface ObjectStorageBackend {
  put(key: string, input: StoredObjectInput): Promise<void>;
  exists(key: string): Promise<boolean>;
  signedDownloadUrl(key: string, expiresIn: number): Promise<string>;
}

export class ObjectStorageConfigurationError extends Error {}

function safeKey(value: string) {
  if (!value || value.length > 500 || value.startsWith('/') || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new ObjectStorageConfigurationError('INVALID_STORAGE_REFERENCE');
  }
  return value;
}

export class ObjectStorageRouter {
  constructor(private active: StorageProvider, private backends: Partial<Record<StorageProvider,ObjectStorageBackend>>) {
    if (!backends[active]) throw new ObjectStorageConfigurationError('ACTIVE_STORAGE_PROVIDER_UNAVAILABLE');
  }

  logicalKey(reference: string) {
    return this.resolve(reference).key;
  }

  async put(key: string, input: StoredObjectInput) {
    const safe = safeKey(key);
    await this.backends[this.active]!.put(safe,input);
    return this.active === 'supabase' ? safe : `${this.active}:${safe}`;
  }

  async exists(reference: string) {
    const resolved=this.resolve(reference);
    return this.backends[resolved.provider]!.exists(resolved.key);
  }

  async signedDownloadUrl(reference: string, expiresIn = 120) {
    const resolved=this.resolve(reference);
    return this.backends[resolved.provider]!.signedDownloadUrl(resolved.key,expiresIn);
  }

  private resolve(reference: string) {
    const match=reference.match(/^(supabase|s3):(.*)$/);
    const provider=(match?.[1] ?? 'supabase') as StorageProvider;
    const key=safeKey(match?.[2] ?? reference);
    if(!this.backends[provider])throw new ObjectStorageConfigurationError('STORAGE_PROVIDER_UNAVAILABLE');
    return {provider,key};
  }
}

class SupabaseStorageBackend implements ObjectStorageBackend {
  constructor(private client: SupabaseClient, private bucket: string) {}
  async put(key: string,input: StoredObjectInput) {
    const {error}=await this.client.storage.from(this.bucket).upload(key,input.bytes,{contentType:input.contentType,upsert:false});
    if(error)throw error;
  }
  async exists(key: string) {
    const {data,error}=await this.client.storage.from(this.bucket).download(key);
    return !error&&!!data;
  }
  async signedDownloadUrl(key: string,expiresIn: number) {
    const {data,error}=await this.client.storage.from(this.bucket).createSignedUrl(key,expiresIn,{download:true});
    if(error||!data?.signedUrl)throw error??new Error('SIGNED_URL_UNAVAILABLE');
    return data.signedUrl;
  }
}

class S3StorageBackend implements ObjectStorageBackend {
  private client: S3Client;
  constructor(private bucket: string, options: {region:string;endpoint?:string;forcePathStyle:boolean;accessKeyId:string;secretAccessKey:string;sessionToken?:string}) {
    this.client=new S3Client({region:options.region,endpoint:options.endpoint,forcePathStyle:options.forcePathStyle,credentials:{accessKeyId:options.accessKeyId,secretAccessKey:options.secretAccessKey,sessionToken:options.sessionToken}});
  }
  async put(key: string,input: StoredObjectInput) {
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:input.bytes,ContentType:input.contentType}));
  }
  async exists(key: string) {
    try {await this.client.send(new HeadObjectCommand({Bucket:this.bucket,Key:key}));return true;}
    catch(error) {
      const status=typeof error==='object'&&error&&'$metadata' in error?(error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode:undefined;
      if(status===404||(error instanceof Error&&['NotFound','NoSuchKey'].includes(error.name)))return false;
      throw error;
    }
  }
  signedDownloadUrl(key: string,expiresIn: number) {
    return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket,Key:key,ResponseContentDisposition:'attachment'}),{expiresIn});
  }
}

type EnvReader=(name:string)=>string|undefined;
const boolean=(value:string|undefined)=>value==='true';
export function createObjectStorageFromEnv(env:EnvReader, supabase?:{url:string;serviceKey:string}|null) {
  const configured=env('STORAGE_PROVIDER');
  const active=(configured??'supabase') as StorageProvider;
  if(!['supabase','s3'].includes(active))throw new ObjectStorageConfigurationError('INVALID_STORAGE_PROVIDER');
  const backends:Partial<Record<StorageProvider,ObjectStorageBackend>>={};
  if(supabase)backends.supabase=new SupabaseStorageBackend(createClient(supabase.url,supabase.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),env('SUPABASE_STORAGE_BUCKET')??'dolend-payments');
  const bucket=env('S3_BUCKET'),region=env('S3_REGION'),accessKeyId=env('S3_ACCESS_KEY_ID'),secretAccessKey=env('S3_SECRET_ACCESS_KEY');
  const anyS3=[bucket,region,accessKeyId,secretAccessKey,env('S3_ENDPOINT'),env('S3_SESSION_TOKEN')].some(Boolean);
  if(anyS3) {
    if(!bucket||!region||!accessKeyId||!secretAccessKey)throw new ObjectStorageConfigurationError('INCOMPLETE_S3_CONFIGURATION');
    backends.s3=new S3StorageBackend(bucket,{region,endpoint:env('S3_ENDPOINT'),forcePathStyle:boolean(env('S3_FORCE_PATH_STYLE')),accessKeyId,secretAccessKey,sessionToken:env('S3_SESSION_TOKEN')});
  }
  if(!backends[active]) {
    if(configured)throw new ObjectStorageConfigurationError('ACTIVE_STORAGE_PROVIDER_UNAVAILABLE');
    return null;
  }
  return new ObjectStorageRouter(active,backends);
}
