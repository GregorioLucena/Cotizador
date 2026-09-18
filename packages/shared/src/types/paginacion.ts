export type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  estadoRegistro: 'ACTIVO' | 'INACTIVO' | 'TODOS';
};

export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginatedMeta;
};
