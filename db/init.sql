-- DB init for qq queue system
CREATE DATABASE IF NOT EXISTS `qq` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `qq`;

CREATE TABLE IF NOT EXISTS `queue_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `queue_no` VARCHAR(10) NOT NULL,
  `position_row` INT NOT NULL,
  `position_col` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'IDLE',
  `called_at` DATETIME NULL,
  `called_by` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
