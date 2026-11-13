/*
  Warnings:

  - You are about to drop the column `paymentMethod` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_saleId_fkey";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "paymentMethod";

-- DropTable
DROP TABLE "Invoice";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- DropEnum
DROP TYPE "InvoiceType";

-- DropEnum
DROP TYPE "PaymentMethod";
