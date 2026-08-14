-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Customer support raw-to-Delta setup
-- MAGIC
-- MAGIC Run each command on the SQL warehouse selected for the app.

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.customer
USING DELTA
COMMENT 'Authoritative customer master used by the customer support app'
AS
SELECT
  customer_id,
  name,
  address,
  phone,
  email,
  lower(customer_level) AS customer_level
FROM read_files(
  '/Volumes/customer_support_rag/support/raw_data/source/customer.csv',
  format => 'csv',
  header => true,
  multiLine => true,
  mode => 'FAILFAST',
  encoding => 'UTF-8',
  schema => 'customer_id STRING, name STRING, address STRING, phone STRING, email STRING, customer_level STRING'
);

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.orders
USING DELTA
COMMENT 'Customer order history loaded from order.csv; product_id is the authoritative product join key'
AS
SELECT
  Transaction_id AS transaction_id,
  try_cast(date_time AS TIMESTAMP) AS ordered_at,
  customer_id,
  address AS delivery_address,
  try_cast(RN AS BIGINT) AS row_number,
  product_id,
  product_name AS product_name_raw
FROM read_files(
  '/Volumes/customer_support_rag/support/raw_data/source/order.csv',
  format => 'csv',
  header => true,
  multiLine => true,
  mode => 'FAILFAST',
  encoding => 'windows-1252',
  schema => 'Transaction_id STRING, date_time STRING, customer_id STRING, address STRING, RN STRING, product_id STRING, product_name STRING'
);

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.cust_service
USING DELTA
COMMENT 'Customer service interactions; customer_id links to the authoritative customer master'
AS
SELECT
  customer_id,
  name AS customer_name_raw,
  email AS customer_email_raw,
  phone_number AS customer_phone_raw,
  address AS customer_address_raw,
  interaction_id,
  try_cast(date_time AS TIMESTAMP) AS interacted_at,
  issue_category,
  issue_description,
  agent_id
FROM read_files(
  '/Volumes/customer_support_rag/support/raw_data/source/cust_service.csv',
  format => 'csv',
  header => true,
  multiLine => true,
  mode => 'FAILFAST',
  encoding => 'UTF-8',
  schema => 'customer_id STRING, name STRING, email STRING, phone_number STRING, address STRING, interaction_id STRING, date_time STRING, issue_category STRING, issue_description STRING, agent_id STRING'
);

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.product_docs
USING DELTA
COMMENT 'Product master and product documentation; product_name here is authoritative'
AS
SELECT
  product_category,
  product_sub_category,
  product_name,
  product_doc,
  product_id,
  indexed_doc
FROM read_files(
  '/Volumes/customer_support_rag/support/raw_data/source/product_docs.csv',
  format => 'csv',
  header => true,
  multiLine => true,
  mode => 'FAILFAST',
  encoding => 'UTF-8',
  escape => '"',
  schema => 'product_category STRING, product_sub_category STRING, product_name STRING, product_doc STRING, product_id STRING, indexed_doc STRING'
);

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.policies
USING DELTA
COMMENT 'Customer support policies used as grounded RAG sources'
AS
SELECT
  policy,
  policy_details,
  try_cast(last_updated AS DATE) AS last_updated
FROM read_files(
  '/Volumes/customer_support_rag/support/raw_data/source/policies.csv',
  format => 'csv',
  header => true,
  multiLine => true,
  mode => 'FAILFAST',
  encoding => 'UTF-8',
  schema => 'policy STRING, policy_details STRING, last_updated STRING'
);

-- COMMAND ----------

CREATE OR REPLACE TABLE customer_support_rag.support.rag_documents
USING DELTA
TBLPROPERTIES (
  delta.enableChangeDataFeed = true
)
COMMENT 'Product and policy documents normalized for Delta Sync AI Search'
AS
SELECT
  sha2(concat('product|', product_id), 256) AS document_id,
  'product' AS source_type,
  product_id AS source_id,
  product_name AS title,
  indexed_doc AS content,
  concat(
    'Document type: product documentation\n',
    'Category: ', product_category, ' / ', product_sub_category, '\n',
    'Product: ', product_name, '\n\n',
    indexed_doc
  ) AS chunk_to_embed,
  concat('catalog://customer_support_rag/support/product_docs/', product_id) AS source_uri,
  current_timestamp() AS refreshed_at
FROM customer_support_rag.support.product_docs
UNION ALL
SELECT
  sha2(concat('policy|', policy), 256) AS document_id,
  'policy' AS source_type,
  policy AS source_id,
  policy AS title,
  policy_details AS content,
  concat(
    'Document type: customer support policy\n',
    'Policy: ', policy, '\n',
    'Last updated: ', cast(last_updated AS STRING), '\n\n',
    policy_details
  ) AS chunk_to_embed,
  concat('catalog://customer_support_rag/support/policies/', sha2(policy, 256)) AS source_uri,
  current_timestamp() AS refreshed_at
FROM customer_support_rag.support.policies;

-- COMMAND ----------

ALTER TABLE customer_support_rag.support.rag_documents
SET TBLPROPERTIES (delta.enableChangeDataFeed = true);

-- COMMAND ----------

SELECT 'customer' AS table_name, count(*) AS row_count FROM customer_support_rag.support.customer
UNION ALL SELECT 'orders', count(*) FROM customer_support_rag.support.orders
UNION ALL SELECT 'cust_service', count(*) FROM customer_support_rag.support.cust_service
UNION ALL SELECT 'product_docs', count(*) FROM customer_support_rag.support.product_docs
UNION ALL SELECT 'policies', count(*) FROM customer_support_rag.support.policies
UNION ALL SELECT 'rag_documents', count(*) FROM customer_support_rag.support.rag_documents
ORDER BY table_name;
