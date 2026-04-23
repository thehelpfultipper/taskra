export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EmptySchema = {
  Tables: Record<string, never>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

export type Database = {
  public: EmptySchema;
};
