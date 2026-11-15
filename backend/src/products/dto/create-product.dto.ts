import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { normalizeCode } from '../product-code.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateProductDto {
  // Scanned codes may include the Code 39 delimiters ("*00001*")
  @Transform(({ value }) => (typeof value === 'string' ? normalizeCode(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description: string;

  // Up to 3 decimals for products sold by length or weight
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  stock: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000_000)
  salePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  minStock?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;
}
